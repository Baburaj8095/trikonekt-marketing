from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Tuple, List

from django.db import transaction, IntegrityError
from django.db.models import Count, Max

from business.models import AutoPoolAccount, CommissionConfig


class PlacementError(RuntimeError):
    pass


class MaxDepthError(PlacementError):
    pass


class NoCapacityError(PlacementError):
    pass


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _first_missing_position(taken: List[int], width: int) -> Optional[int]:
    seen = set(int(p or 0) for p in taken if p is not None)
    for pos in range(1, int(width) + 1):
        if pos not in seen:
            return pos
    return None


def _ensure_sentinel_root(pool_type: str) -> AutoPoolAccount:
    """
    Ensure exactly one sentinel root row exists for given pool_type:
      - parent_account = NULL
      - level = 0
      - position = NULL
      - status = ACTIVE
      - owner = company/superuser (non-nullable FK)
    Uses transaction + get_or_create to avoid duplicates; final uniqueness enforced by DB constraint (to be added).
    """
    cfg = CommissionConfig.get_solo()
    owner = None
    # Prefer configured Root Consumer if available and eligible
    try:
        from business.models import RootConsumerConfig
        rc = RootConsumerConfig.get_solo()
        owner = rc.get_root_user()
    except Exception:
        owner = None
    if owner is None:
        owner = cfg.get_company_user()
    if owner is None:
        # Fallback: pick any superuser or staff as root owner (required due to NOT NULL FK)
        from accounts.models import CustomUser
        owner = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.filter(is_staff=True).first()
        if owner is None:
            # As a last resort pick any user; should never happen in real deployments
            owner = CustomUser.objects.order_by("id").first()
            if owner is None:
                raise PlacementError("No eligible owner user found for sentinel root")

    # Try fetch fast path
    root = AutoPoolAccount.objects.filter(pool_type=pool_type, parent_account__isnull=True, level=0).order_by("id").first()
    if root:
        return root

    # Create under lock for idempotency
    with transaction.atomic():
        root = (
            AutoPoolAccount.objects.select_for_update()
            .filter(pool_type=pool_type, parent_account__isnull=True, level=0)
            .first()
        )
        if root:
            return root
        # Compute a user_entry_index for the sentinel owner/pool under lock to satisfy uniqueness
        try:
            sel2 = AutoPoolAccount.objects.select_for_update()
        except TypeError:
            sel2 = AutoPoolAccount.objects.select_for_update()
        cur_max = (sel2.filter(owner=owner, pool_type=pool_type).aggregate(m=Max("user_entry_index")) or {}).get("m") or 0
        root = AutoPoolAccount.objects.create(
            owner=owner,
            username_key=getattr(owner, "username", "") or f"ROOT-{pool_type}",
            entry_amount=_q2(0),
            pool_type=pool_type,
            status="ACTIVE",
            parent_account=None,
            level=0,
            position=None,
            user_entry_index=int(cur_max) + 1,
            source_type="SENTINEL",
            source_id=pool_type,
        )
        return root


def is_level_full(level: int, width: int, pool_type: str) -> bool:
    """
    Returns True if number of ACTIVE accounts at the given level is at least width**level.
    Root is at level 0. Children of root are at level 1.
    """
    if level < 0:
        return True
    expected = (int(width) ** int(level))
    actual = AutoPoolAccount.objects.filter(pool_type=pool_type, level=int(level), status="ACTIVE").count()
    return actual >= expected


def find_next_placement_slot(width: int, max_depth: int, pool_type: str, start_account_id: Optional[int] = None) -> Tuple[AutoPoolAccount, int, int]:
    """
    BFS TOP -> DOWN -> LEFT -> RIGHT strictly under the sentinel root tree (single genealogy).
    Returns (parent_row, position, child_level).
    Strict width-before-depth: never place in level N+1 unless level N (for the current sentinel subtree) is fully filled.
    Raises NoCapacityError if no slot exists within configured max_depth.
    """
    # Enforce single sentinel root per pool (reattach stray roots) before searching
    try:
        from business.services.structure import enforce_single_sentinel
        enforce_single_sentinel(pool_type)
    except Exception:
        pass

    # Allow starting BFS from a sponsor's subtree root if provided; else use sentinel
    if start_account_id:
        root = AutoPoolAccount.objects.filter(id=int(start_account_id), pool_type=pool_type, status="ACTIVE").first()
        if not root:
            root = _ensure_sentinel_root(pool_type)
    else:
        root = _ensure_sentinel_root(pool_type)

    # Build BFS frontier restricted to the sentinel tree:
    # level 0 parents = [root], next level parents = children of previous level parents, and so on.
    current_parents: List[int] = [int(root.id)]

    # parent_level ranges from 0 (root) to max_depth-1 (so child at level <= max_depth)
    for parent_level in range(0, int(max_depth)):
        if not current_parents:
            # Should not happen under normal growth; implies sentinel subtree missing this level
            break

        found_slot: Optional[Tuple[AutoPoolAccount, int, int]] = None

        # Same-level round-robin: pos-major, then parent-id order
        for pos_try in range(1, int(width) + 1):
            for pid in current_parents:
                with transaction.atomic():
                    try:
                        qs = AutoPoolAccount.objects.select_for_update(skip_locked=True)
                    except TypeError:
                        qs = AutoPoolAccount.objects.select_for_update()
                    parent = qs.filter(id=int(pid)).first()
                    if not parent:
                        # locked by another tx; move on
                        continue

                    child_level = int(getattr(parent, "level", 0) or 0) + 1
                    if child_level > int(max_depth):
                        raise MaxDepthError(f"Max depth reached for pool={pool_type}: next={child_level}, configured={max_depth}")

                    exists = AutoPoolAccount.objects.filter(
                        parent_account=parent,
                        pool_type=pool_type,
                        status="ACTIVE",
                        position=int(pos_try),
                    ).exists()
                    if not exists:
                        found_slot = (parent, int(pos_try), child_level)
                        break
            if found_slot:
                break

        if found_slot:
            return found_slot

        # WIDTH-BEFORE-DEPTH ENFORCEMENT (restricted to sentinel subtree at this level):
        # Ensure all parents at this level have all width child slots filled before proceeding deeper.
        total_children = AutoPoolAccount.objects.filter(
            parent_account_id__in=current_parents, pool_type=pool_type, status="ACTIVE"
        ).count()
        expected_children = int(width) * len(current_parents)
        if total_children < expected_children:
            # There are still free slots within this child level in the sentinel subtree (likely concurrent).
            # Do not proceed deeper; caller should retry later.
            raise NoCapacityError(
                f"Width-before-depth enforcement: level {parent_level+1} under sentinel not full for pool={pool_type}; retry after contention"
            )

        # Advance BFS frontier to next level strictly under these parents
        next_parents = list(
            AutoPoolAccount.objects.filter(parent_account_id__in=current_parents, pool_type=pool_type, status="ACTIVE")
            .order_by("id")
            .values_list("id", flat=True)
        )
        current_parents = [int(x) for x in next_parents]

    raise NoCapacityError(f"No placement capacity for pool={pool_type} up to maxDepth={max_depth} (width={width}).")


class GenericPlacement:
    """
    Deterministic forced-matrix placement (TOP→DOWN→LEFT→RIGHT) shared by 3×N and 5×N pools.
    """

    @staticmethod
    def configured_width_and_depth(pool_type: str) -> Tuple[int, int]:
        cfg = CommissionConfig.get_solo()
        if pool_type == "FIVE_150":
            width = 5
            max_depth = int(cfg.get_matrix_five_levels() or 10)
        elif pool_type in ("THREE_150", "THREE_50"):
            width = 3
            max_depth = int(cfg.get_matrix_three_levels() or 15)
        else:
            raise PlacementError(f"Unsupported pool_type {pool_type}")
        if max_depth <= 0:
            raise PlacementError(f"Configured max depth must be positive for {pool_type}")
        return (width, max_depth)

    @staticmethod
    @transaction.atomic
    def place_account(
        *,
        owner,
        pool_type: str,
        amount: Decimal,
        source_type: str = "",
        source_id: str = "",
        width: Optional[int] = None,
        max_depth: Optional[int] = None,
        start_entry_id: Optional[int] = None,
    ) -> AutoPoolAccount:
        """
        Place a new AutoPoolAccount deterministically under a subtree:
        - If start_entry_id is provided, BFS within that subtree
        - Otherwise, under the global sentinel tree
        Strict width-before-depth and round-robin at the same level.
        Fails with MaxDepthError/NoCapacityError instead of falling back to sponsor/self.
        """
        if width is None or max_depth is None:
            w, d = GenericPlacement.configured_width_and_depth(pool_type)
            width = w if width is None else width
            max_depth = d if max_depth is None else max_depth

        # Find the slot (locks parent row)
        parent, position, child_level = find_next_placement_slot(
            int(width), int(max_depth), pool_type, start_account_id=int(start_entry_id) if start_entry_id else None
        )

        # Compute deterministic display key (compatible with existing suffix behavior)
        uname = AutoPoolAccount._next_username_key(owner, pool_type)

        # Retry-loop to handle sibling position race and per-user index race
        attempts = 0
        while True:
            attempts += 1
            try:
                # Use an inner savepoint so an IntegrityError doesn't break the outer atomic block
                with transaction.atomic():
                    # Compute next monotonic user_entry_index per (owner, pool_type) under lock
                    try:
                        sel = AutoPoolAccount.objects.select_for_update()
                    except TypeError:
                        sel = AutoPoolAccount.objects.select_for_update()
                    cur_max = (sel.filter(owner=owner, pool_type=pool_type).aggregate(m=Max("user_entry_index")) or {}).get("m") or 0
                    next_idx = int(cur_max) + 1

                    acc = AutoPoolAccount.objects.create(
                        owner=owner,
                        username_key=uname,
                        entry_amount=_q2(amount or 0),
                        pool_type=pool_type,
                        status="ACTIVE",
                        parent_account=parent,
                        level=int(child_level),
                        position=int(position),
                        user_entry_index=int(next_idx),
                        source_type=source_type or "",
                        source_id=str(source_id or ""),
                    )
                    return acc
            except IntegrityError:
                if attempts >= 5:
                    # Re-throw a clear error; caller can decide to retry externally
                    raise NoCapacityError(f"Lost race creating account for {pool_type} (parent={getattr(parent, 'id', None)} pos={position}); retry later")
                # Recompute a slot and try again
                parent, position, child_level = find_next_placement_slot(
                    int(width), int(max_depth), pool_type, start_account_id=int(start_entry_id) if start_entry_id else None
                )

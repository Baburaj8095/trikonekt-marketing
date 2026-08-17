from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional, Tuple, List

from django.db import transaction, IntegrityError
from django.db.models import Count, Max

from business.models import AutoPoolAccount, CommissionConfig
try:
    from coupons.models import AuditTrail
except Exception:
    AuditTrail = None


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
    root = AutoPoolAccount.objects.filter(pool_type=pool_type, parent_account__isnull=True).order_by("id").first()
    if root:
        return root

    # Create under lock for idempotency
    with transaction.atomic():
        root = (
            AutoPoolAccount.objects.select_for_update()
            .filter(pool_type=pool_type, parent_account__isnull=True)
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
    # Ensure at least one sentinel exists for this pool. Do not reseat existing trees.
    try:
        _ensure_sentinel_root(pool_type)
    except Exception:
        pass

    # Allow starting BFS from a sponsor's subtree root if provided; else use sentinel
    if start_account_id:
        root = AutoPoolAccount.objects.filter(id=int(start_account_id), pool_type=pool_type, status="ACTIVE").first()
        if not root:
            root = _ensure_sentinel_root(pool_type)
    else:
        root = _ensure_sentinel_root(pool_type)

    # Build BFS frontier restricted to the sentinel tree.
    # IMPORTANT PERF NOTE:
    # The previous implementation used nested (pos × parents) loops with per-row transactions and EXISTS queries.
    # During large backfills this explodes into millions of queries and can leave Postgres sessions
    # "idle in transaction" for a long time.
    #
    # We now:
    #   - avoid per-row `transaction.atomic()` entirely in the scan phase
    #   - use a single GROUP BY to find the first parent at the current frontier that has < width children
    #   - only fetch child positions for that one parent to compute the first missing position
    #
    # Concurrency safety remains acceptable because account creation is protected by unique constraints
    # and GenericPlacement.place_account retries on IntegrityError.

    current_parents: List[int] = [int(root.id)]

    # parent_level ranges from 0 (root) to max_depth-1 (so child at level <= max_depth)
    for parent_level in range(0, int(max_depth)):
        if not current_parents:
            break

        # Fetch parents once (ordered), so we can keep deterministic left-to-right behavior.
        parents = list(
            AutoPoolAccount.objects.filter(id__in=current_parents)
            .only("id", "level")
            .order_by("id")
        )
        if not parents:
            break
        parent_ids = [int(p.id) for p in parents]

        # Count children per parent (include ALL statuses: CLOSED still occupies a position structurally)
        counts_by_parent: dict[int, int] = {}
        for pid, ct in (
            AutoPoolAccount.objects.filter(parent_account_id__in=parent_ids, pool_type=pool_type)
            .values_list("parent_account_id")
            .annotate(ct=Count("id"))
            .values_list("parent_account_id", "ct")
        ):
            try:
                counts_by_parent[int(pid)] = int(ct or 0)
            except Exception:
                continue

        # Find the first parent with < width children (BFS / left-to-right)
        target_parent: Optional[AutoPoolAccount] = None
        for p in parents:
            ct = int(counts_by_parent.get(int(p.id), 0) or 0)
            if ct < int(width):
                target_parent = p
                break

        if target_parent is not None:
            child_level = int(getattr(target_parent, "level", 0) or 0) + 1
            rel_depth = child_level - int(getattr(root, "level", 0) or 0)
            if start_account_id and rel_depth > int(max_depth):
                raise MaxDepthError(
                    f"Max relative depth reached under start_account={start_account_id} for pool={pool_type}: rel={rel_depth}, configured={max_depth}"
                )

            # Fetch positions for this one parent only (fast) and pick first missing.
            taken_positions = list(
                AutoPoolAccount.objects.filter(
                    parent_account_id=int(target_parent.id),
                    pool_type=pool_type,
                ).values_list("position", flat=True)
            )
            pos = _first_missing_position([int(x or 0) for x in taken_positions], int(width))
            if pos is None:
                # Shouldn't happen if ct < width, but be defensive under races.
                raise NoCapacityError(
                    f"Unable to find free slot under parent={int(target_parent.id)} for pool={pool_type}; retry"
                )
            return (target_parent, int(pos), int(child_level))

        # WIDTH-BEFORE-DEPTH ENFORCEMENT:
        # If total children at this frontier is < width * parents, we should not go deeper.
        total_children = int(sum(int(v or 0) for v in counts_by_parent.values()))
        expected_children = int(width) * len(parent_ids)
        if total_children < expected_children:
            raise NoCapacityError(
                f"Width-before-depth enforcement: level {parent_level+1} under sentinel not full for pool={pool_type}; retry after contention"
            )

        # Advance BFS frontier to next level strictly under these parents
        current_parents = list(
            AutoPoolAccount.objects.filter(
                parent_account_id__in=parent_ids,
                pool_type=pool_type,
                status="ACTIVE",
            )
            .order_by("id")
            .values_list("id", flat=True)
        )

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
        # Acquire a transaction-level advisory lock on the pool type to serialize concurrent placements
        try:
            from django.db import connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", [pool_type])
        except Exception:
            pass

        if width is None or max_depth is None:
            w, d = GenericPlacement.configured_width_and_depth(pool_type)
            width = w if width is None else width
            max_depth = d if max_depth is None else max_depth

        # Find the slot (locks parent row)
        try:
            parent, position, child_level = find_next_placement_slot(
                int(width), int(max_depth), pool_type, start_account_id=int(start_entry_id) if start_entry_id else None
            )
        except (MaxDepthError, NoCapacityError) as mde:
            if start_entry_id:
                try:
                    if AuditTrail is not None:
                        AuditTrail.objects.create(
                            action="placement_fallback_global",
                            actor=None,
                            notes=f"Fallback to global sentinel root after sponsor subtree reached depth: {mde}",
                            metadata={
                                "pool_type": pool_type,
                                "owner_id": getattr(owner, "id", None),
                                "start_entry_id": int(start_entry_id),
                                "configured_max_depth": int(max_depth),
                            },
                        )
                except Exception:
                    pass
                return cls.place_account(owner, pool_type, width, max_depth, start_entry_id=None)

            # Record an audit trail entry for operational visibility before re-raising
            try:
                if AuditTrail is not None:
                    AuditTrail.objects.create(
                        action="placement_max_depth",
                        actor=None,
                        notes=str(mde),
                        metadata={
                            "pool_type": pool_type,
                            "owner_id": getattr(owner, "id", None),
                            "start_entry_id": int(start_entry_id) if start_entry_id else None,
                            "configured_max_depth": int(max_depth),
                        },
                    )
            except Exception:
                pass
            raise

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
                try:
                    parent, position, child_level = find_next_placement_slot(
                        int(width), int(max_depth), pool_type, start_account_id=int(start_entry_id) if start_entry_id else None
                    )
                except MaxDepthError as mde:
                    try:
                        if AuditTrail is not None:
                            AuditTrail.objects.create(
                                action="placement_max_depth",
                                actor=None,
                                notes=str(mde),
                                metadata={
                                    "pool_type": pool_type,
                                    "owner_id": getattr(owner, "id", None),
                                    "start_entry_id": int(start_entry_id) if start_entry_id else None,
                                    "configured_max_depth": int(max_depth),
                                },
                            )
                    except Exception:
                        pass
                    raise

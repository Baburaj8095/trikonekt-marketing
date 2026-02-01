from __future__ import annotations

from typing import List, Optional, Dict, Any

from django.db import transaction
from django.db.models import Q

from business.models import AutoPoolAccount
from business.services.placement import _ensure_sentinel_root, GenericPlacement


class SentinelEnforcementError(RuntimeError):
    pass


@transaction.atomic
def enforce_single_sentinel(pool_type: str) -> AutoPoolAccount:
    """
    Enforce exactly one structural sentinel root for a given pool_type.

    Rules:
      - Keep the earliest (lowest id) row with parent_account IS NULL as the canonical sentinel.
      - For any additional rows with parent_account IS NULL:
          * Reattach them under the canonical sentinel (parent_account=sentinel)
          * Set their level to 1 and position = NULL (to avoid contention/violations)
          * Increment the level of their entire subtree by +1 to preserve relative depth
      - Never delete rows.
      - Idempotent and safe to re-run.

    Returns the canonical sentinel root.
    """
    # Ensure at least one root exists (this will also choose an owner if needed)
    sentinel = _ensure_sentinel_root(pool_type)

    # Find all "root-like" nodes for this pool (parent is NULL)
    roots_qs = (
        AutoPoolAccount.objects
        .filter(pool_type=pool_type, parent_account__isnull=True)
        .order_by("id")
    )
    roots = list(roots_qs.values_list("id", flat=True))
    if not roots:
        # Should not happen since _ensure_sentinel_root() created one
        return sentinel

    canonical_id = int(roots[0])
    if canonical_id != int(getattr(sentinel, "id", canonical_id)):
        # Refetch canonical to keep a consistent ORM object
        sentinel = AutoPoolAccount.objects.filter(id=canonical_id).first() or sentinel

    extra_root_ids: List[int] = [int(rid) for rid in roots[1:] if int(rid) != canonical_id]
    if not extra_root_ids:
        return sentinel

    # For each extra root, reattach under canonical sentinel and shift subtree levels by +1
    for rid in extra_root_ids:
        root = AutoPoolAccount.objects.select_for_update().filter(id=rid).first()
        if not root:
            continue
        # Detach from "root" and attach under sentinel with position=NULL (safe, no conflict)
        root.parent_account_id = canonical_id
        root.level = 1
        root.position = None
        root.save(update_fields=["parent_account", "level", "position"])

        # Shift entire subtree level by +1 to preserve relative depth
        # BFS over children to avoid recursion depth
        frontier = [int(root.id)]
        while frontier:
            children = list(
                AutoPoolAccount.objects
                .filter(parent_account_id__in=frontier, pool_type=pool_type)
                .values_list("id", "level")
            )
            if not children:
                break
            child_ids = [int(cid) for (cid, _lvl) in children]
            # Bulk increment levels for this batch
            # SQLite lacks F() + 1 on UPDATE with JSON/complex constraints reliably; update in chunks
            chunk = 100
            for i in range(0, len(child_ids), chunk):
                ids_chunk = child_ids[i:i + chunk]
                # naive update: fetch rows and update to avoid DB-specific arithmetic
                for c in AutoPoolAccount.objects.filter(id__in=ids_chunk):
                    try:
                        c.level = int(getattr(c, "level", 0) or 0) + 1
                        c.save(update_fields=["level"])
                    except Exception:
                        continue
            frontier = child_ids

    return sentinel


# ===== Tree building (read-only) and display root resolution =====

def get_display_start_entry(pool_type: str, display_user_id: int | None = None) -> int:
    """
    Resolve UI display start entry id.
    - If display_user_id is provided, return earliest ACTIVE entry for that user in this pool.
    - Else return the sentinel root id.
    This function has NO structural side-effects.
    """
    sentinel = _ensure_sentinel_root(pool_type)
    if display_user_id:
        try:
            head = (AutoPoolAccount.objects
                    .filter(owner_id=int(display_user_id), pool_type=pool_type, status="ACTIVE")
                    .order_by("id")
                    .only("id")
                    .first())
            if head:
                return int(head.id)
        except Exception:
            pass
    return int(getattr(sentinel, "id", 0))


def build_tree(pool_type: str, start_entry_id: int | None = None, *, max_nodes: int = 1000, max_depth: int | None = None) -> Dict[str, Any]:
    """
    Entry-based matrix tree builder (read-only).
    Source of truth:
      - AutoPoolAccount.parent_account
      - id, level, position, status, pool_type
    Excludes INACTIVE/CLOSED entries.
    """
    # Ensure single sentinel exists; read-only otherwise
    sentinel = _ensure_sentinel_root(pool_type)
    root_id = int(start_entry_id) if start_entry_id else int(sentinel.id)

    # Depth bound: default to configured pool depth
    try:
        if max_depth is None:
            width, cfg_depth = GenericPlacement.configured_width_and_depth(pool_type)
            max_depth = int(cfg_depth)
        else:
            width, _ = GenericPlacement.configured_width_and_depth(pool_type)
    except Exception:
        width, max_depth = (5 if pool_type == "FIVE_150" else 3), (6 if pool_type == "FIVE_150" else 15)

    # Verify start root exists and ACTIVE
    start = AutoPoolAccount.objects.filter(id=root_id, pool_type=pool_type, status="ACTIVE").only("id", "level").first()
    if not start:
        # Fallback to sentinel if invalid
        start = AutoPoolAccount.objects.filter(id=int(sentinel.id), pool_type=pool_type, status="ACTIVE").only("id", "level").first()
        if not start:
            # Tree is empty (only sentinel may exist inactive); return empty
            return {"root_id": root_id, "pool_type": pool_type, "nodes": []}
        root_id = int(start.id)

    # BFS traversal
    nodes: list[dict] = []
    visited = set()
    frontier = [(int(start.id), int(getattr(start, "level", 0) or 0))]  # (node_id, level)
    while frontier and len(nodes) < int(max_nodes):
        nid, lvl = frontier.pop(0)
        if nid in visited:
            continue
        visited.add(nid)
        # Fetch node snapshot
        row = (AutoPoolAccount.objects
               .filter(id=nid, pool_type=pool_type, status="ACTIVE")
               .select_related("parent_account", "owner")
               .only("id", "owner_id", "parent_account_id", "level", "position", "status")
               .first())
        if not row:
            continue
        nodes.append({
            "id": int(row.id),
            "owner_id": int(getattr(row, "owner_id", 0) or 0),
            "parent_id": int(getattr(row, "parent_account_id", 0) or 0) or None,
            "level": int(getattr(row, "level", 0) or 0),
            "position": int(getattr(row, "position", 0) or 0) or None,
            "status": str(getattr(row, "status", "")),
        })
        # stop at depth bound (child level = lvl+1)
        if int(lvl) >= int(max_depth):
            continue
        # Enqueue children ordered left-to-right by position then id
        child_qs = (AutoPoolAccount.objects
                    .filter(parent_account_id=nid, pool_type=pool_type, status="ACTIVE")
                    .order_by("position", "id")
                    .only("id", "level"))
        for cid in child_qs.values_list("id", flat=True):
            frontier.append((int(cid), int(lvl) + 1))
        # Optional guard to keep at most width**(depth) nodes; max_nodes already caps breadth

    return {"root_id": root_id, "pool_type": pool_type, "nodes": nodes}

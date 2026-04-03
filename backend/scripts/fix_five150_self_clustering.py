"""
Re-place existing FIVE_150 entries that are NOT under their owner's base entry.
Uses BFS under the owner's base entry to find the next available slot
and moves the entry there.

Usage:
  DRY RUN (default):   python scripts/fix_five150_self_clustering.py
  APPLY:               python scripts/fix_five150_self_clustering.py --apply
"""
import os, sys, django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from collections import deque
from django.db import transaction
from business.models import AutoPoolAccount


APPLY = "--apply" in sys.argv
POOL = "FIVE_150"


def is_ancestor(entry_id, ancestor_id):
    """Walk up parent chain to check if ancestor_id is an ancestor of entry_id."""
    cur = entry_id
    seen = set()
    while cur and cur not in seen:
        if cur == ancestor_id:
            return True
        seen.add(cur)
        parent = AutoPoolAccount.objects.filter(id=cur).values_list("parent_account_id", flat=True).first()
        cur = parent
    return False


def find_slot_under(base_id, width=5, max_depth=10):
    """
    BFS under base_id to find the next available (parent, position) slot.
    Returns (parent_account_id, position, child_level) or None.
    """
    base = AutoPoolAccount.objects.filter(id=base_id, pool_type=POOL).first()
    if not base:
        return None

    base_level = base.level or 0
    current_parents = [base_id]

    for depth_offset in range(0, max_depth):
        if not current_parents:
            break

        # Try each position across all parents at this level (position-major order)
        for pos in range(1, width + 1):
            for pid in current_parents:
                exists = AutoPoolAccount.objects.filter(
                    parent_account_id=pid,
                    pool_type=POOL,
                    position=pos,
                ).exists()
                if not exists:
                    parent = AutoPoolAccount.objects.filter(id=pid).first()
                    child_level = (parent.level if parent else base_level + depth_offset) + 1
                    return (pid, pos, child_level)

        # Advance to next level
        next_parents = list(
            AutoPoolAccount.objects.filter(
                parent_account_id__in=current_parents,
                pool_type=POOL,
            ).order_by("id").values_list("id", flat=True)
        )
        current_parents = list(next_parents)

    return None


def get_entries_needing_move():
    """
    Find all FIVE_150 entries where the owner has multiple entries
    and the 2nd+ entry is NOT under the base (first) entry.
    """
    from django.db.models import Count, Min

    # Users with >1 FIVE_150 entry
    multi_owners = list(
        AutoPoolAccount.objects.filter(pool_type=POOL)
        .values("owner_id")
        .annotate(cnt=Count("id"))
        .filter(cnt__gt=1)
        .values_list("owner_id", flat=True)
    )

    needs_move = []
    for uid in multi_owners:
        entries = list(
            AutoPoolAccount.objects.filter(owner_id=uid, pool_type=POOL)
            .order_by("user_entry_index")
            .values_list("id", "username_key", "user_entry_index", "parent_account_id")
        )
        if len(entries) < 2:
            continue

        base_id = entries[0][0]

        for eid, ukey, idx, pid in entries[1:]:
            if not is_ancestor(eid, base_id):
                needs_move.append({
                    "entry_id": eid,
                    "owner_id": uid,
                    "username_key": ukey,
                    "base_id": base_id,
                    "current_parent": pid,
                })

    return needs_move


def has_children(entry_id):
    """Check if an entry has any children placed under it."""
    return AutoPoolAccount.objects.filter(parent_account_id=entry_id, pool_type=POOL).exists()


def collect_subtree_ids(entry_id):
    """Collect all descendant IDs of an entry (BFS)."""
    result = []
    queue = deque([entry_id])
    while queue:
        cur = queue.popleft()
        children = list(
            AutoPoolAccount.objects.filter(parent_account_id=cur, pool_type=POOL)
            .values_list("id", flat=True)
        )
        result.extend(children)
        queue.extend(children)
    return result


def main():
    entries = get_entries_needing_move()

    if not entries:
        print("All FIVE_150 entries are already correctly placed under their base entry.")
        print("Nothing to do.")
        return

    print(f"{'DRY RUN' if not APPLY else 'APPLYING'}: {len(entries)} entries need to move under their base entry")
    print("=" * 80)

    moved = 0
    skipped_has_children = 0
    skipped_no_slot = 0
    errors = 0

    for e in entries:
        eid = e["entry_id"]
        base_id = e["base_id"]
        ukey = e["username_key"]
        uid = e["owner_id"]

        # Safety: skip entries that have children (moving them would orphan the children)
        if has_children(eid):
            subtree = collect_subtree_ids(eid)
            print(f"  SKIP entry {eid} ({ukey}) owner={uid}: has {len(subtree)} descendants, cannot safely move")
            skipped_has_children += 1
            continue

        # Find next available slot under the base entry
        slot = find_slot_under(base_id, width=5, max_depth=10)
        if not slot:
            print(f"  SKIP entry {eid} ({ukey}) owner={uid}: no available slot under base {base_id}")
            skipped_no_slot += 1
            continue

        new_parent_id, new_position, new_level = slot

        entry_obj = AutoPoolAccount.objects.filter(id=eid).first()
        if not entry_obj:
            errors += 1
            continue

        old_parent = entry_obj.parent_account_id
        old_pos = entry_obj.position
        old_level = entry_obj.level

        print(f"  {'MOVE' if APPLY else 'WOULD MOVE'} entry {eid} ({ukey}) owner={uid}")
        print(f"    FROM: parent={old_parent} pos={old_pos} level={old_level}")
        print(f"    TO:   parent={new_parent_id} pos={new_position} level={new_level}")

        if APPLY:
            try:
                with transaction.atomic():
                    # Verify slot is still available
                    conflict = AutoPoolAccount.objects.filter(
                        parent_account_id=new_parent_id,
                        pool_type=POOL,
                        position=new_position,
                    ).exists()
                    if conflict:
                        print(f"    CONFLICT: slot already taken, retrying...")
                        slot2 = find_slot_under(base_id, width=5, max_depth=10)
                        if not slot2:
                            print(f"    FAILED: no slot available")
                            skipped_no_slot += 1
                            continue
                        new_parent_id, new_position, new_level = slot2

                    entry_obj.parent_account_id = new_parent_id
                    entry_obj.position = new_position
                    entry_obj.level = new_level
                    entry_obj.save(update_fields=["parent_account_id", "position", "level"])
                    moved += 1
                    print(f"    OK")
            except Exception as ex:
                print(f"    ERROR: {ex}")
                errors += 1
        else:
            moved += 1

    print()
    print("=" * 80)
    print(f"Summary ({'DRY RUN' if not APPLY else 'APPLIED'}):")
    print(f"  {'Would move' if not APPLY else 'Moved'}: {moved}")
    print(f"  Skipped (has children): {skipped_has_children}")
    print(f"  Skipped (no slot): {skipped_no_slot}")
    print(f"  Errors: {errors}")

    if not APPLY and moved > 0:
        print(f"\nTo apply: python scripts/fix_five150_self_clustering.py --apply")


if __name__ == "__main__":
    main()

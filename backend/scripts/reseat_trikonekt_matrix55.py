#!/usr/bin/env python
import os
import sys

# Move to backend/ and setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from decimal import Decimal
from django.db import transaction
from accounts.models import CustomUser
from business.models import AutoPoolAccount
from business.services.placement import _ensure_sentinel_root


POOL = "FIVE_150"


def uname(n: int) -> str:
    return f"TR{n:010d}"


def ensure_sentinel_owner_trikonekt():
    root_user = CustomUser.objects.filter(username="TRIKONEKT").first()
    if not root_user:
        print("ERROR: TRIKONEKT user not found")
        return None
    sentinel = _ensure_sentinel_root(POOL)
    if sentinel.owner_id != root_user.id:
        old = getattr(sentinel.owner, "username", None)
        sentinel.owner_id = root_user.id
        try:
            sentinel.username_key = getattr(root_user, "username", "") or (sentinel.username_key or f"ROOT-{POOL}")
        except Exception:
            pass
        sentinel.save(update_fields=["owner", "username_key"])
        print(f"Updated sentinel owner: {old} -> {root_user.username}")
    else:
        print(f"Sentinel already owned by {root_user.username}")
    print(f"Sentinel id={sentinel.id}, level={sentinel.level}, parent={sentinel.parent_account_id}, pos={sentinel.position}")
    return sentinel


def reseat(dry_run: bool = False, close_existing_level1: bool = True):
    sentinel = ensure_sentinel_owner_trikonekt()
    if not sentinel:
        return

    # Prepare target usernames
    batch1 = [uname(n) for n in range(9000000001, 9000000020 + 1)]
    batch2 = [uname(n) for n in range(9000000021, 9000000055 + 1)]
    targets = batch1 + batch2

    # Resolve target users
    users = {}
    missing = []
    for u in targets:
        cu = CustomUser.objects.filter(username=u, category="consumer").first()
        if not cu:
            missing.append(u)
        else:
            users[u] = cu
    if missing:
        print(f"WARNING: Missing {len(missing)} users (first 10): {', '.join(missing[:10])}")

    # Close existing level-1 accounts under sentinel (optionally only non-target owners)
    level1_qs = AutoPoolAccount.objects.filter(
        pool_type=POOL, status="ACTIVE", parent_account_id=sentinel.id, level=1
    ).select_related("owner").order_by("position", "id")

    # Close ALL existing level-1 accounts under sentinel to free positions 1..5
    to_close_level1 = list(level1_qs) if close_existing_level1 else []
    if to_close_level1:
        print(f"Closing {len(to_close_level1)} existing level-1 accounts under sentinel (not in desired first 5).")
        if not dry_run:
            for acc in to_close_level1:
                acc.status = "CLOSED"
            AutoPoolAccount.objects.bulk_update(to_close_level1, ["status"])

    # Close any existing ACTIVE accounts for our target users to force fresh placement
    owned_active = list(
        AutoPoolAccount.objects.filter(pool_type=POOL, status="ACTIVE", owner__username__in=list(users.keys()))
        .select_related("owner")
        .order_by("level", "parent_account_id", "position", "id")
    )
    if owned_active:
        print(f"Closing {len(owned_active)} existing ACTIVE accounts for target users to reseat.")
        if not dry_run:
            for acc in owned_active:
                acc.status = "CLOSED"
            AutoPoolAccount.objects.bulk_update(owned_active, ["status"])

    # Place in deterministic order to fill L1 first: first place the first 5 users,
    # then the remaining in their numeric order.
    ordered_for_placement = batch1[:5] + [u for u in targets if u not in set(batch1[:5])]
    placed = 0
    errors = 0
    skipped = 0

    if dry_run:
        print(f"[DRY RUN] Would place {len(ordered_for_placement)} accounts in order: first5={batch1[:5]} ... total={len(ordered_for_placement)}")
        return

    for uname_s in ordered_for_placement:
        cu = users.get(uname_s)
        if not cu:
            skipped += 1
            continue
        # Idempotency: if already ACTIVE after previous loop (rare race), skip
        exists = AutoPoolAccount.objects.filter(owner=cu, pool_type=POOL, status="ACTIVE").exists()
        if exists:
            skipped += 1
            continue
        try:
            AutoPoolAccount.create_five_150_for_user(
                cu,
                amount=Decimal("150.00"),
                source_type="RESEAT",
                source_id=uname_s,
            )
            placed += 1
        except Exception as e:
            print(f"ERROR placing {uname_s}: {e}")
            errors += 1

    print(f"Reseat complete. placed={placed}, skipped_existing={skipped}, errors={errors}")

    # Post-sync CustomUser.parent/matrix_position/depth to reflect AutoPool placement
    try:
        print("Syncing CustomUser.parent/matrix_position/depth from AutoPool...")
        from django.core.management import call_command
        # Call the sync script logic inline to avoid a new process
        updated = 0
        skipped2 = 0
        errs2 = 0
        qs = (AutoPoolAccount.objects
              .select_related("owner", "parent_account", "parent_account__owner")
              .filter(pool_type=POOL, status="ACTIVE")
              .exclude(level=0)
              .order_by("level", "parent_account_id", "position", "id"))
        with transaction.atomic():
            for acc in qs:
                child = getattr(acc, "owner", None)
                parent_acc = getattr(acc, "parent_account", None)
                parent_owner = getattr(parent_acc, "owner", None) if parent_acc else None
                pos = getattr(acc, "position", None)
                lvl = int(getattr(acc, "level", 0) or 0)
                if not child or not getattr(child, "id", None) or not parent_owner or pos is None:
                    skipped2 += 1
                    continue
                try:
                    dirty = False
                    if getattr(child, "parent_id", None) != parent_owner.id:
                        child.parent_id = parent_owner.id
                        dirty = True
                    if getattr(child, "matrix_position", None) != int(pos):
                        child.matrix_position = int(pos)
                        dirty = True
                    if getattr(child, "depth", 0) != int(lvl):
                        child.depth = int(lvl)
                        dirty = True
                    if dirty:
                        child.save(update_fields=["parent", "matrix_position", "depth"])
                        updated += 1
                    else:
                        skipped2 += 1
                except Exception:
                    errs2 += 1
        print(f"Sync summary: updated={updated}, skipped={skipped2}, errors={errs2}")
    except Exception as e:
        print(f"Sync step failed: {e}")


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="Reseat the 55 TRIKONEKT seed consumers into FIVE_150 to occupy L1 first, then breadth-first.")
    p.add_argument("--dry-run", action="store_true", help="Only print actions without modifying data")
    p.add_argument("--keep-existing-level1", action="store_true", help="Do NOT close existing L1 accounts under sentinel (default is to close non-targets)")
    args = p.parse_args()

    reseat(dry_run=bool(args.dry_run), close_existing_level1=(not bool(args.keep_existing_level1)))

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

from django.db import transaction
from accounts.models import CustomUser
from business.models import AutoPoolAccount

def main():
    pool = "FIVE_150"
    updated = 0
    skipped = 0
    errors = 0

    # Exclude sentinel (level=0). Only ACTIVE accounts.
    qs = (AutoPoolAccount.objects
          .select_related("owner", "parent_account", "parent_account__owner")
          .filter(pool_type=pool, status="ACTIVE")
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
                skipped += 1
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
                    # UniqueConstraint on (parent, matrix_position) guarded by deterministic placement
                    child.save(update_fields=["parent", "matrix_position", "depth"])
                    updated += 1
                else:
                    skipped += 1
            except Exception:
                errors += 1

    print(f"Sync complete for pool={pool}. updated={updated}, skipped={skipped}, errors={errors}")

    # Cleanup: remove stale matrix parent links for users not represented by ACTIVE FIVE_150 accounts
    try:
        root = CustomUser.objects.filter(username="TRIKONEKT").only("id", "username").first()
        if root:
            stale = []
            children_under_root = list(
                CustomUser.objects.filter(parent_id=root.id, category="consumer")
                .only("id", "username", "parent_id", "matrix_position", "depth")
            )
            for child in children_under_root:
                has_active_mapping = AutoPoolAccount.objects.filter(
                    pool_type=pool,
                    status="ACTIVE",
                    owner_id=child.id,
                    parent_account__owner_id=root.id,
                ).exists()
                if not has_active_mapping:
                    child.parent_id = None
                    child.matrix_position = None
                    child.depth = 0
                    stale.append(child)
            if stale:
                CustomUser.objects.bulk_update(stale, ["parent", "matrix_position", "depth"])
    except Exception:
        pass

    # Quick verification for TRIKONEKT root if present
    root = CustomUser.objects.filter(username="TRIKONEKT").only("id", "username").first()
    if root:
        children = list(
            CustomUser.objects.filter(parent_id=root.id, category="consumer")
            .only("id", "username", "matrix_position")
            .order_by("matrix_position", "id")
        )
        print(f"TRIKONEKT children (matrix view): count={len(children)}")
        for c in children[:10]:
            print(f"  {getattr(c, 'username', '')} pos={getattr(c, 'matrix_position', None)}")
        if len(children) > 10:
            print(f"  ... (+{len(children)-10} more)")

if __name__ == "__main__":
    main()

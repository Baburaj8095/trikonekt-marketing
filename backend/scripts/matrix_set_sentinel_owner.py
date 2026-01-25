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

from accounts.models import CustomUser
from business.models import AutoPoolAccount
from business.services.placement import _ensure_sentinel_root

def set_owner(pool_type: str, owner_username: str):
    owner = CustomUser.objects.filter(username=owner_username).first()
    if not owner:
        print(f"ERROR: owner user not found: {owner_username}")
        return False

    # Ensure a sentinel exists (may create one if missing)
    root = _ensure_sentinel_root(pool_type)
    changed = False
    if root.owner_id != owner.id:
        old_owner = getattr(root.owner, "username", None)
        root.owner_id = owner.id
        try:
            root.username_key = getattr(owner, "username", "") or (root.username_key or f"ROOT-{pool_type}")
        except Exception:
            pass
        root.save(update_fields=["owner", "username_key"])
        print(f"Updated sentinel owner for {pool_type}: {old_owner} -> {owner.username} (id={owner.id})")
        changed = True
    else:
        print(f"Sentinel for {pool_type} already owned by {owner.username} (id={owner.id})")
    print(f"Sentinel id={root.id}, level={root.level}, parent={root.parent_account_id}, position={root.position}")
    return changed

def main():
    # Target: ensure TRIKONEKT owns the FIVE_150 sentinel
    changed = set_owner("FIVE_150", "TRIKONEKT")
    if changed:
        print("Owner changed. Run sync_matrix_from_autopool.py to realign user.parent/matrix_position/depth.")
    else:
        print("No change to sentinel owner.")

if __name__ == "__main__":
    main()

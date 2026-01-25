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

def uname(n: int) -> str:
    return f"TR{n:010d}"

def main():
    root = CustomUser.objects.filter(username="TRIKONEKT").first()
    if not root:
        print("ERROR: TRIKONEKT user not found")
        return
    print(f"Root user: id={root.id} username={root.username}")

    # Sponsor-based first-level (registered_by)
    sp_first = list(
        CustomUser.objects.filter(registered_by_id=root.id, category="consumer")
        .order_by("id")
        .values_list("username", flat=True)
    )
    print(f"Sponsor children count (registered_by): {len(sp_first)}")
    print("Sponsor children sample:", sp_first[:10])

    # Matrix-based first-level (parent)
    mx_first = list(
        CustomUser.objects.filter(parent_id=root.id, category="consumer")
        .order_by("matrix_position", "id")
        .values_list("username", "matrix_position")
    )
    print(f"Matrix children count (parent): {len(mx_first)}")
    print("Matrix children sample:", mx_first[:10])

    # Sentinel root for FIVE_150
    sentinel = _ensure_sentinel_root("FIVE_150")
    print(f"Sentinel FIVE_150: id={sentinel.id}, level={sentinel.level}, owner={getattr(sentinel.owner, 'username', None)}")

    # Accounts under sentinel (level 1 accounts)
    accounts_level1 = list(
        AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE", parent_account_id=sentinel.id)
        .order_by("position", "id")
        .values_list("owner__username", "position", "id")
    )
    print(f"AutoPool level-1 accounts under sentinel: {len(accounts_level1)}")
    print("AutoPool level-1 sample:", accounts_level1[:10])

    # Total ACTIVE accounts in FIVE_150
    total_active = AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE").count()
    print(f"Total ACTIVE FIVE_150 accounts: {total_active}")

    # Check a few specific users
    samples = [uname(9000000001), uname(9000000002), uname(9000000020), uname(9000000021)]
    for u in samples:
        cu = CustomUser.objects.filter(username=u).first()
        if not cu:
            print(f"User {u}: MISSING")
            continue
        acc = AutoPoolAccount.objects.filter(owner=cu, pool_type="FIVE_150", status="ACTIVE").order_by("id").first()
        print(
            f"{u}: parent_id={cu.parent_id}, pos={cu.matrix_position}, depth={cu.depth}, "
            f"has_acc={'Y' if acc else 'N'}, acc_parent_owner={getattr(getattr(acc, 'parent_account', None), 'owner', None) and acc.parent_account.owner.username if acc and acc.parent_account and acc.parent_account.owner else None}"
        )

if __name__ == "__main__":
    main()

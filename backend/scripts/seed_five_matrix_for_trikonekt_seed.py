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
from accounts.models import CustomUser
from business.models import AutoPoolAccount
from business.services.placement import _ensure_sentinel_root

def uname(num: int) -> str:
    return f"TR{num:010d}"

def main():
    # Ensure sentinel root for FIVE_150 exists (owned by TRIKONEKT via RootConsumerConfig)
    root = _ensure_sentinel_root("FIVE_150")
    print(f"Sentinel root for FIVE_150: id={root.id}, owner={getattr(root.owner, 'username', None)}, level={root.level}")

    # Users to place: TR9000000001..TR9000000055 (first 55 we created)
    all_nums = list(range(9000000001, 9000000055 + 1))
    all_unames = [uname(n) for n in all_nums]

    placed = 0
    skipped = 0
    missing = []
    errors = []

    for u in all_unames:
        user = CustomUser.objects.filter(username=u).first()
        if not user:
            missing.append(u)
            continue
        # Idempotency: skip if already has an ACTIVE five_150 account
        exists = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150", status="ACTIVE").exists()
        if exists:
            skipped += 1
            continue
        try:
            AutoPoolAccount.create_five_150_for_user(user, amount=Decimal("150.00"), source_type="SEED", source_id=u)
            placed += 1
        except Exception as e:
            errors.append((u, str(e)))

    print(f"FIVE_150 placement done. placed={placed}, skipped_existing={skipped}, missing_users={len(missing)}, errors={len(errors)}")
    if missing:
        print("Missing users:", ", ".join(missing[:10]) + (f" ... (+{len(missing)-10})" if len(missing) > 10 else ""))
    if errors:
        for u, msg in errors[:10]:
            print(f"Error for {u}: {msg}")
        if len(errors) > 10:
            print(f"... (+{len(errors)-10} more)")

if __name__ == "__main__":
    main()

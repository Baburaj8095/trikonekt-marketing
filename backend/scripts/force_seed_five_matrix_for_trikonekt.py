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
from business.services.placement import _ensure_sentinel_root, GenericPlacement

POOL = "FIVE_150"

def uname(n: int) -> str:
    return f"TR{n:010d}"

def ensure_sentinel_to_trikonekt():
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

def main():
    sentinel = ensure_sentinel_to_trikonekt()
    if not sentinel:
        return

    # Target users: 55 seeds (20 direct + 35 under first 5)
    targets = [uname(n) for n in range(9000000001, 9000000055 + 1)]

    # Resolve users
    users = {}
    missing = []
    for un in targets:
        u = CustomUser.objects.filter(username=un).first()
        if not u:
            missing.append(un)
        else:
            users[un] = u

    if missing:
        print(f"WARNING: Missing {len(missing)} users: {', '.join(missing[:10])}{' ...' if len(missing) > 10 else ''}")

    # Close any existing ACTIVE accounts for these users to allow clean placement
    exist_qs = list(
        AutoPoolAccount.objects.filter(pool_type=POOL, status="ACTIVE", owner__username__in=list(users.keys()))
        .select_related("owner")
        .order_by("level", "parent_account_id", "position", "id")
    )
    if exist_qs:
        print(f"Closing {len(exist_qs)} existing ACTIVE accounts for target users")
        for acc in exist_qs:
            acc.status = "CLOSED"
        AutoPoolAccount.objects.bulk_update(exist_qs, ["status"])

    # Force placement using GenericPlacement directly (bypasses is_matrix_eligible gate in model helpers)
    created = 0
    skipped = 0
    errors = 0

    # Ensure first 5 fill L1 by placing them first, then the rest in numeric order
    first5 = [uname(9000000000 + i) for i in range(1, 6)]
    order = first5 + [u for u in targets if u not in set(first5)]

    for un in order:
        u = users.get(un)
        if not u:
            skipped += 1
            continue
        # Idempotency: if ACTIVE exists after prior steps, skip
        if AutoPoolAccount.objects.filter(owner=u, pool_type=POOL, status="ACTIVE").exists():
            skipped += 1
            continue
        try:
            with transaction.atomic():
                acc = GenericPlacement.place_account(
                    owner=u,
                    pool_type=POOL,
                    amount=Decimal("150.00"),
                    source_type="FORCE_SEED",
                    source_id=un,
                )
                if acc:
                    created += 1
                else:
                    skipped += 1
        except Exception as e:
            print(f"ERROR placing {un}: {e}")
            errors += 1

    print(f"Force seed done. created={created}, skipped={skipped}, errors={errors}")

if __name__ == "__main__":
    main()

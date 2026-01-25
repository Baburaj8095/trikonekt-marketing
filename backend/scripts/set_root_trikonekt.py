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
from business.models import RootConsumerConfig, AutoPoolAccount
from business.services.placement import _ensure_sentinel_root


def main():
    username = "TRIKONEKT"
    email = "baburajnk19@gmail.com"
    phone = "8095918105"
    password = "12345678"

    # 1) Create or update the TRIKONEKT consumer with exact credentials
    user, created = CustomUser.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "role": "user",
            "category": "consumer",
            "is_staff": False,
            "is_superuser": False,
            "account_active": True,
            "full_name": "TRIKONEKT",
            "phone": phone,
        },
    )
    # Ensure fields match the request
    user.email = email
    try:
        user.full_name = "TRIKONEKT"
    except Exception:
        pass
    try:
        user.phone = phone
    except Exception:
        pass
    user.role = "user"
    user.category = "consumer"
    user.is_staff = False
    user.is_superuser = False
    user.account_active = True
    user.set_password(password)
    user.save()

    # 2) Set as Root Consumer (singleton)
    cfg = RootConsumerConfig.get_solo()
    cfg.root_user = user
    cfg.save(update_fields=["root_user", "updated_at"])

    # 3) Ensure/repair level=0 sentinel roots for 5× and 3× matrices
    pools = ["FIVE_150", "THREE_150"]
    msgs = []
    for pool in pools:
        root = AutoPoolAccount.objects.filter(
            pool_type=pool, parent_account__isnull=True, level=0
        ).first()
        if root:
            # Re-own existing sentinel under TRIKONEKT
            root.owner = user
            try:
                root.username_key = f"ROOT-{pool}"
            except Exception:
                pass
            root.save(update_fields=["owner", "username_key"])
            msgs.append(f"Re-owned existing root for {pool} id={root.id}")
        else:
            # Create sentinel if missing (owned by TRIKONEKT via RootConsumerConfig)
            r = _ensure_sentinel_root(pool)
            if r.owner_id != user.id:
                r.owner = user
                try:
                    r.username_key = f"ROOT-{pool}"
                except Exception:
                    pass
                r.save(update_fields=["owner", "username_key"])
            msgs.append(f"Ensured root for {pool} id={r.id}")

    print(f"Root Consumer set to: {user.username} (id={user.id}). " + " | ".join(msgs))


if __name__ == "__main__":
    main()

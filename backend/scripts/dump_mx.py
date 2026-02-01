#!/usr/bin/env python
import os
import sys
import json
from datetime import datetime

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

def serialize_user(u):
    return {
        "id": u.id,
        "username": u.username,
        "category": u.category,
        "is_staff": bool(getattr(u, "is_staff", False)),
        "is_superuser": bool(getattr(u, "is_superuser", False)),
        "account_active": bool(getattr(u, "account_active", False)),
        "first_purchase_activated_at": getattr(u, "first_purchase_activated_at", None) and str(getattr(u, "first_purchase_activated_at")),
    }

def serialize_account(a):
    return {
        "id": a.id,
        "owner_id": a.owner_id,
        "owner_username": getattr(a.owner, "username", None),
        "pool_type": a.pool_type,
        "status": a.status,
        "level": a.level,
        "position": a.position,
        "parent_account_id": a.parent_account_id,
        "source_type": a.source_type,
        "source_id": a.source_id,
        "created_at": str(a.created_at),
    }

def main():
    out = {
        "generated_at": datetime.now().isoformat(),
        "pools": {},
    }

    for pool in ("FIVE_150", "THREE_150"):
        try:
            sentinel = _ensure_sentinel_root(pool)
        except Exception as e:
            sentinel = None

        # Totals
        total = AutoPoolAccount.objects.filter(pool_type=pool).count()
        total_active = AutoPoolAccount.objects.filter(pool_type=pool, status="ACTIVE").count()
        out["pools"][pool] = {
            "total_accounts": total,
            "total_active": total_active,
            "sentinel": {
                "id": getattr(sentinel, "id", None),
                "owner_id": getattr(getattr(sentinel, "owner", None), "id", None) if sentinel else None,
                "owner_username": getattr(getattr(sentinel, "owner", None), "username", None) if sentinel else None,
                "level": getattr(sentinel, "level", None) if sentinel else None,
            },
            "level1_under_sentinel": [],
            "sample_accounts": [],
        }

        # Level 1 accounts under sentinel
        if sentinel:
            lvl1 = list(
                AutoPoolAccount.objects.select_related("owner").filter(
                    pool_type=pool, status="ACTIVE", parent_account_id=sentinel.id
                ).order_by("position", "id")[:50]
            )
            out["pools"][pool]["level1_under_sentinel"] = [serialize_account(a) for a in lvl1]

        # Sample of first 50 active accounts with owner flags
        accs = list(
            AutoPoolAccount.objects.select_related("owner").filter(
                pool_type=pool, status="ACTIVE"
            ).order_by("id")[:50]
        )
        out["pools"][pool]["sample_accounts"] = [
            {
                "account": serialize_account(a),
                "owner": serialize_user(a.owner) if getattr(a, "owner", None) else None,
            }
            for a in accs
        ]

    # Also include TRIKONEKT user and first 50 consumers minimal matrix presence
    root = CustomUser.objects.filter(username="TRIKONEKT").first() or CustomUser.objects.filter(id=32).first()
    users = list(CustomUser.objects.filter(category="consumer").order_by("id")[:50])
    out["root_user"] = serialize_user(root) if root else None
    out["users_matrix_presence"] = []
    for u in ([root] if root else []) + users:
        if not u:
            continue
        row = serialize_user(u)
        row["has_FIVE_150"] = AutoPoolAccount.objects.filter(owner_id=u.id, pool_type="FIVE_150", status="ACTIVE").exists()
        row["has_THREE_150"] = AutoPoolAccount.objects.filter(owner_id=u.id, pool_type="THREE_150", status="ACTIVE").exists()
        out["users_matrix_presence"].append(row)

    # Write to logs
    logs_dir = os.path.join(os.path.dirname(BASE_DIR), "logs")
    try:
        os.makedirs(logs_dir, exist_ok=True)
    except Exception:
        pass
    out_path = os.path.join(logs_dir, "mx_dump.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"Wrote {out_path}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python
import os, sys, json
from datetime import datetime

# Setup Django (run from backend/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser
from business.models import AutoPoolAccount
from business.services.placement import _ensure_sentinel_root

OUT_PATH = os.path.join(BASE_DIR, "logs", "tr_diag.json")

def uname(n: int) -> str:
    return f"TR{n:010d}"

def main():
    out = {"generated_at": datetime.utcnow().isoformat() + "Z"}
    try:
        root = CustomUser.objects.filter(username="TRIKONEKT").first()
        out["trikonekt"] = {
            "found": bool(root),
            "id": getattr(root, "id", None),
            "username": getattr(root, "username", None),
        }
        sent = _ensure_sentinel_root("FIVE_150")
        out["sentinel"] = {
            "id": getattr(sent, "id", None),
            "owner_id": getattr(sent, "owner_id", None),
            "owner_username": getattr(getattr(sent, "owner", None), "username", None),
            "level": getattr(sent, "level", None),
            "parent_account_id": getattr(sent, "parent_account_id", None),
            "position": getattr(sent, "position", None),
        }

        # Level-1 accounts under sentinel
        lvl1 = list(
            AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE", parent_account_id=sent.id, level=1)
            .select_related("owner")
            .order_by("position", "id")[:50]
        )
        out["level1_under_sentinel"] = {
            "count": len(lvl1),
            "owners": [
                {
                    "owner_id": getattr(a.owner, "id", None),
                    "owner_username": getattr(a.owner, "username", None),
                    "position": a.position,
                    "account_id": a.id,
                }
                for a in lvl1
            ],
        }

        # Matrix children (CustomUser.parent) under TRIKONEKT
        if root:
            children = list(
                CustomUser.objects.filter(parent_id=root.id, category="consumer")
                .only("id", "username", "matrix_position", "depth")
                .order_by("matrix_position", "id")[:50]
            )
            out["matrix_children_under_trikonekt"] = {
                "count": CustomUser.objects.filter(parent_id=root.id, category="consumer").count(),
                "sample": [
                    {
                        "id": c.id,
                        "username": c.username,
                        "matrix_position": c.matrix_position,
                        "depth": c.depth,
                    }
                    for c in children
                ],
            }
            # Sponsor directs (registered_by)
            directs = list(
                CustomUser.objects.filter(registered_by_id=root.id, category="consumer")
                .only("id", "username")
                .order_by("id")[:50]
            )
            out["sponsor_directs_under_trikonekt"] = {
                "count": CustomUser.objects.filter(registered_by_id=root.id, category="consumer").count(),
                "sample": [{"id": u.id, "username": u.username} for u in directs],
            }

        # Check seed users 1..5
        seed_first5 = [uname(9000000000 + i) for i in range(1, 6)]
        seed_rows = []
        for u in seed_first5:
            cu = CustomUser.objects.filter(username=u).first()
            acc = None
            parent_owner_un = None
            pos = None
            if cu:
                acc = AutoPoolAccount.objects.filter(owner_id=cu.id, pool_type="FIVE_150", status="ACTIVE").order_by("level", "id").first()
                if acc and acc.parent_account_id:
                    try:
                        po = getattr(acc.parent_account, "owner", None)
                        parent_owner_un = getattr(po, "username", None)
                    except Exception:
                        parent_owner_un = None
                pos = getattr(cu, "matrix_position", None)
            seed_rows.append({
                "username": u,
                "exists": bool(cu),
                "user_id": getattr(cu, "id", None),
                "matrix_parent_id": getattr(cu, "parent_id", None) if cu else None,
                "matrix_position": pos,
                "autopool_active": bool(acc),
                "autopool_parent_owner": parent_owner_un,
            })
        out["seed_first5"] = seed_rows

    except Exception as e:
        out["error"] = str(e)

    # Ensure logs directory
    try:
        os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)
    except Exception:
        pass

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Written {OUT_PATH}")

if __name__ == "__main__":
    main()

#!/usr/bin/env python
import os
import sys
import json

# Move to backend/ and setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../backend
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from business.models import AutoPoolAccount  # noqa: E402
from accounts.models import CustomUser  # noqa: E402


def earliest_active_entry_for_user(user_id: int | None, pool: str):
    if not user_id:
        return None
    return (
        AutoPoolAccount.objects.select_related("owner")
        .filter(owner_id=user_id, pool_type=pool, status="ACTIVE")
        .order_by("id")
        .first()
    )


def children_of(parent_id: int, pool: str):
    return list(
        AutoPoolAccount.objects.select_related("owner")
        .filter(parent_account_id=parent_id, pool_type=pool, status="ACTIVE")
        .order_by("position", "id")
        .values("id", "owner_id", "owner__username", "position")
    )


def main():
    ident = sys.argv[1] if len(sys.argv) > 1 else "1217"

    # Resolve user
    user = None
    if ident.isdigit():
        user = CustomUser.objects.filter(id=int(ident)).first()
    if not user:
        user = CustomUser.objects.filter(username__iexact=ident).first() or user
    if not user:
        user = CustomUser.objects.filter(prefixed_id__iexact=ident).first() or user

    uid = getattr(user, "id", None)
    uname = getattr(user, "username", None)

    out = {
        "query": ident,
        "user_id": uid,
        "username": uname,
        "pools": {},
    }

    for pool in ("FIVE_150", "THREE_150"):
        root = earliest_active_entry_for_user(uid, pool)
        node = {
            "has_entry": bool(root),
            "root_account_id": getattr(root, "id", None),
            "root_level": int(getattr(root, "level", 0) or 0) if root else None,
            "children": [],
            "child_count": 0,
        }
        if root:
            kids = children_of(int(root.id), pool)
            node["children"] = kids
            node["child_count"] = len(kids)
        out["pools"][pool] = node

    # Save to logs and also print to stdout
    ROOT_DIR = os.path.dirname(BASE_DIR)
    logs_dir = os.path.join(ROOT_DIR, "logs")
    try:
        os.makedirs(logs_dir, exist_ok=True)
    except Exception:
        pass
    out_path = os.path.join(logs_dir, f"quick_children_{uid or 'na'}.json")
    try:
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    print(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"WROTE {out_path}")


if __name__ == "__main__":
    main()

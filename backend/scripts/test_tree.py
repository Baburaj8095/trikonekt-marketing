#!/usr/bin/env python
import os
import sys
import json

# Setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser
from rest_framework.test import APIRequestFactory, force_authenticate
from adminapi.views import AdminMatrix5Tree

def call_tree(root_user_id: int, pool: str, source: str, max_depth: int = 10):
    factory = APIRequestFactory()
    url = f"/api/admin/matrix/tree5/?root_user_id={root_user_id}&pool={pool}&source={source}&max_depth={max_depth}"
    request = factory.get(url)
    # Authenticate as superuser
    su = CustomUser.objects.filter(is_superuser=True).order_by("id").first() or CustomUser.objects.filter(is_staff=True).order_by("id").first()
    if not su:
        raise SystemExit("No admin/staff user to authenticate with")
    force_authenticate(request, user=su)
    view = AdminMatrix5Tree.as_view()
    response = view(request)
    try:
        data = json.loads(json.dumps(response.data, default=str))
    except Exception:
        data = response.data
    return data

def summarize(tree):
    if not tree or not isinstance(tree, dict):
        return {"ok": False, "reason": "no tree"}
    return {
        "root": {
            "id": tree.get("id"),
            "username": tree.get("username"),
            "level": tree.get("level"),
            "matrix_position": tree.get("matrix_position"),
            "depth": tree.get("depth"),
        },
        "children_count": len(tree.get("children") or []),
        "first_children": [
            {"id": c.get("id"), "username": c.get("username"), "pos": c.get("matrix_position")}
            for c in (tree.get("children") or [])[:10]
        ],
    }

def main():
    roots = [32, 101]  # TRIKONEKT and first child
    tests = [
        ("FIVE_150", "matrix", 10),
        ("THREE_150", "matrix", 15),
    ]
    out = {}
    for rid in roots:
        for pool, source, depth in tests:
            tree = call_tree(rid, pool, source, depth)
            out[f"{rid}:{pool}_{source}"] = summarize(tree)

    # Write also to project logs for inspection
    try:
        root_dir = os.path.dirname(BASE_DIR)
        logs_dir = os.path.join(root_dir, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        out_path = os.path.join(logs_dir, "test_tree.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("WARN: failed writing logs/test_tree.json:", e, file=sys.stderr)
    print(json.dumps(out, indent=2))

if __name__ == "__main__":
    main()

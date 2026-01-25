#!/usr/bin/env python
import os, sys, json
from datetime import datetime

# Move to backend/ and setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser

OUT_PATH = os.path.join(BASE_DIR, "logs", "verify_tr.json")

def uname(num: int) -> str:
    return f"TR{num:010d}"

def main():
    out = {"generated_at": datetime.utcnow().isoformat() + "Z"}
    try:
        pincode_expected = "560001"
        # Ranges per spec
        first_range = list(range(9000000001, 9000000020 + 1))   # 20 users
        second_range = list(range(9000000021, 9000000055 + 1))  # 35 users

        first_unames = [uname(n) for n in first_range]
        second_unames = [uname(n) for n in second_range]

        # Existence checks
        first_found = list(CustomUser.objects.filter(username__in=first_unames).values_list("username", flat=True))
        second_found = list(CustomUser.objects.filter(username__in=second_unames).values_list("username", flat=True))

        out["existence"] = {
            "first_present": len(first_found),
            "first_missing": sorted(list(set(first_unames) - set(first_found))),
            "second_present": len(second_found),
            "second_missing": sorted(list(set(second_unames) - set(second_found))),
        }

        # Sponsor checks
        root = CustomUser.objects.filter(username="TRIKONEKT").first()
        out["root"] = {"found": bool(root), "id": getattr(root, "id", None)}
        direct_under_root = 0
        per_sponsor = {}
        if root:
            first_qs = CustomUser.objects.filter(username__in=first_unames)
            direct_under_root = first_qs.filter(registered_by=root).count()

            sponsors = [uname(9000000000 + i) for i in range(1, 6)]
            second_qs = CustomUser.objects.filter(username__in=second_unames)
            for su in sponsors:
                s = CustomUser.objects.filter(username=su).first()
                per_sponsor[su] = {
                    "exists": bool(s),
                    "id": getattr(s, "id", None),
                    "directs_count": second_qs.filter(registered_by=s).count() if s else 0,
                }

        out["sponsorship"] = {
            "direct_under_trikonekt_first_batch": direct_under_root,
            "second_batch_distribution": per_sponsor,
        }

        # Pincode check
        pincode_first_bad = list(CustomUser.objects.filter(username__in=first_unames).exclude(pincode=pincode_expected).values_list("username", "pincode"))
        pincode_second_bad = list(CustomUser.objects.filter(username__in=second_unames).exclude(pincode=pincode_expected).values_list("username", "pincode"))
        out["pincode"] = {
            "expected": pincode_expected,
            "first_ok": 20 - len(pincode_first_bad),
            "first_bad": pincode_first_bad,
            "second_ok": 35 - len(pincode_second_bad),
            "second_bad": pincode_second_bad,
        }

        # Role/Category check
        bad_role_first = list(CustomUser.objects.filter(username__in=first_unames).exclude(role="user").values_list("username", "role"))
        bad_cat_first = list(CustomUser.objects.filter(username__in=first_unames).exclude(category="consumer").values_list("username", "category"))
        bad_role_second = list(CustomUser.objects.filter(username__in=second_unames).exclude(role="user").values_list("username", "role"))
        bad_cat_second = list(CustomUser.objects.filter(username__in=second_unames).exclude(category="consumer").values_list("username", "category"))
        out["role_category"] = {
            "first_role_user_ok": 20 - len(bad_role_first),
            "first_role_bad": bad_role_first,
            "first_cat_consumer_ok": 20 - len(bad_cat_first),
            "first_cat_bad": bad_cat_first,
            "second_role_user_ok": 35 - len(bad_role_second),
            "second_role_bad": bad_role_second,
            "second_cat_consumer_ok": 35 - len(bad_cat_second),
            "second_cat_bad": bad_cat_second,
        }

        # Sample mapping (first few)
        sample_unames = first_unames[:3] + second_unames[:3]
        sample_map = []
        for u in sample_unames:
            obj = CustomUser.objects.filter(username=u).first()
            if not obj:
                sample_map.append({"username": u, "exists": False})
                continue
            sp = getattr(obj.registered_by, 'username', None)
            sample_map.append({"username": u, "exists": True, "sponsor": sp, "pincode": getattr(obj, "pincode", None)})
        out["samples"] = sample_map

    except Exception as e:
        out["error"] = str(e)

    # Ensure logs directory
    try:
        os.makedirs(os.path.join(BASE_DIR, "logs"), exist_ok=True)
    except Exception:
        pass

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print(f"Wrote {OUT_PATH}")

if __name__ == "__main__":
    main()

import os
import sys
import json

# Ensure backend/ is on sys.path so 'core' package is importable
_CUR = os.path.dirname(__file__)
_BACKEND_DIR = os.path.abspath(os.path.join(_CUR, ".."))
_PROJECT_ROOT = os.path.abspath(os.path.join(_CUR, "..", ".."))
for p in (_BACKEND_DIR, _PROJECT_ROOT):
    if p not in sys.path:
        sys.path.append(p)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.utils import timezone  # noqa: E402
from accounts.models import CustomUser, AgencyRegionAssignment  # noqa: E402


ROLE_CATEGORIES = [
    ("Sub Franchise", "agency_sub_franchise"),
    ("Pincode", "agency_pincode"),
    ("Pincode Coord", "agency_pincode_coordinator"),
]


def brief_user(u):
    if not u:
        return None
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "category": u.category,
        "state_id": getattr(u.state, "id", None),
        "state": getattr(u.state, "name", None),
        "pincode": (u.pincode or "").strip(),
    }


def main():
    out = {"ok": True, "now": timezone.now().isoformat()}
    try:
        user_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    except Exception:
        user_id = None
    if not user_id:
        out["ok"] = False
        out["error"] = "missing_user_id_arg"
    else:
        try:
            consumer = CustomUser.objects.get(id=user_id)
        except CustomUser.DoesNotExist:
            out["ok"] = False
            out["error"] = f"user_not_found:{user_id}"
            consumer = None

        out["consumer"] = brief_user(consumer)

        created = []
        resolved = {}

        if consumer:
            pin = (consumer.pincode or "").strip()
            state = getattr(consumer, "state", None)
            if not pin:
                out["ok"] = False
                out["error"] = "consumer_missing_pincode"
            else:
                for label, cat in ROLE_CATEGORIES:
                    # Prefer agency in same state if possible, else any
                    qs = CustomUser.objects.filter(category=cat).order_by("id")
                    if state:
                        qs_state = qs.filter(state=state)
                        agency = qs_state.first() or qs.first()
                    else:
                        agency = qs.first()

                    resolved[label] = brief_user(agency)

                    if not agency:
                        continue

                    # Idempotent create
                    obj, was_created = AgencyRegionAssignment.objects.get_or_create(
                        user=agency,
                        level="pincode",
                        pincode=pin,
                        defaults={"state": state},
                    )
                    if was_created:
                        created.append(
                            {
                                "label": label,
                                "agency": brief_user(agency),
                                "assignment_id": obj.id,
                                "pincode": pin,
                                "state_id": getattr(state, "id", None),
                            }
                        )

        out["resolved"] = resolved
        out["created"] = created

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"seed_pincode_{user_id or 'NA'}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

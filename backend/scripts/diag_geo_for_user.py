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
from accounts.models import CustomUser  # noqa: E402
from business.models import CommissionConfig  # noqa: E402


def brief_user(u):
    if not u:
        return None
    return {
        "id": u.id,
        "username": u.username,
        "role": u.role,
        "category": u.category,
        "pincode": (u.pincode or "").strip(),
        "state_id": getattr(u.state, "id", None),
        "state": getattr(u.state, "name", None),
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

        if consumer:
            pin = (consumer.pincode or "").strip()
            state = getattr(consumer, "state", None)

            # Build recipient resolution identical to distribute_auto_pool_commissions
            qs_sf = CustomUser.objects.filter(
                category="agency_sub_franchise",
                region_assignments__level="pincode",
                region_assignments__pincode=pin,
            ).distinct() if pin else CustomUser.objects.none()

            qs_pincode = CustomUser.objects.filter(
                category="agency_pincode",
                region_assignments__level="pincode",
                region_assignments__pincode=pin,
            ).distinct() if pin else CustomUser.objects.none()

            qs_pincode_coord = CustomUser.objects.filter(
                category="agency_pincode_coordinator",
                region_assignments__level="pincode",
                region_assignments__pincode=pin,
            ).distinct() if pin else CustomUser.objects.none()

            qs_district = CustomUser.objects.filter(
                category="agency_district",
                region_assignments__level="district",
                region_assignments__state=state,
            ).distinct() if state else CustomUser.objects.none()

            qs_district_coord = CustomUser.objects.filter(
                category="agency_district_coordinator",
                region_assignments__level="district",
                region_assignments__state=state,
            ).distinct() if state else CustomUser.objects.none()

            qs_state = CustomUser.objects.filter(
                category="agency_state",
                region_assignments__level="state",
                region_assignments__state=state,
            ).distinct() if state else CustomUser.objects.none()

            qs_state_coord = CustomUser.objects.filter(
                category="agency_state_coordinator",
                region_assignments__level="state",
                region_assignments__state=state,
            ).distinct() if state else CustomUser.objects.none()

            data = {
                "pin_available": bool(pin),
                "pin_value": pin,
                "state_available": bool(state),
                "state_id": getattr(state, "id", None),
                "state_name": getattr(state, "name", None),
                "resolved": {
                    "Sub Franchise": {
                        "count": qs_sf.count(),
                        "first": brief_user(qs_sf.first()),
                    },
                    "Pincode": {
                        "count": qs_pincode.count(),
                        "first": brief_user(qs_pincode.first()),
                    },
                    "Pincode Coord": {
                        "count": qs_pincode_coord.count(),
                        "first": brief_user(qs_pincode_coord.first()),
                    },
                    "District": {
                        "count": qs_district.count(),
                        "first": brief_user(qs_district.first()),
                    },
                    "District Coord": {
                        "count": qs_district_coord.count(),
                        "first": brief_user(qs_district_coord.first()),
                    },
                    "State": {
                        "count": qs_state.count(),
                        "first": brief_user(qs_state.first()),
                    },
                    "State Coord": {
                        "count": qs_state_coord.count(),
                        "first": brief_user(qs_state_coord.first()),
                    },
                },
            }
            out["geo_resolution"] = data

            # Config snapshot for 150 fixed splits
            try:
                cfg = CommissionConfig.get_solo()
                master = dict(getattr(cfg, "master_commission_json", {}) or {})
                mode_150 = ((master.get("geo_mode", {}) or {}).get("150", None))
                fixed_150 = ((master.get("geo_fixed", {}) or {}).get("150", None))
                out["config"] = {
                    "geo_mode_150": mode_150,
                    "geo_fixed_150": fixed_150,
                }
            except Exception as e:
                out["config_error"] = f"{type(e).__name__}: {e}"

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"diag_geo_{user_id or 'NA'}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

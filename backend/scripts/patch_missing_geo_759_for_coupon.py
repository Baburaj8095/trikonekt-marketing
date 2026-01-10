import os
import sys
import json
from decimal import Decimal

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
from accounts.models import CustomUser, Wallet, WalletTransaction, AgencyRegionAssignment  # noqa: E402
from business.models import CommissionConfig  # noqa: E402
from coupons.models import CouponCode  # noqa: E402


def _q2(x):
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


ROLES = [
    ("Sub Franchise", "agency_sub_franchise", "sub_franchise"),
    ("Pincode", "agency_pincode", "pincode"),
    ("Pincode Coord", "agency_pincode_coordinator", "pincode_coord"),
]


def _resolve_agency_users(consumer: CustomUser):
    pin = (getattr(consumer, "pincode", "") or "").strip()
    state = getattr(consumer, "state", None)
    out = {}
    if not pin:
        return out
    for label, category, _key in ROLES:
        # Prefer explicit region assignment for pincode
        assign = AgencyRegionAssignment.objects.filter(level="pincode", pincode=pin, user__category=category).select_related("user").first()
        if assign and assign.user:
            out[label] = assign.user
            continue
        # Fallback to any agency in same state, else any
        qs = CustomUser.objects.filter(category=category).order_by("id")
        user = None
        if state:
            user = qs.filter(state=state).first() or qs.first()
        else:
            user = qs.first()
        if user:
            out[label] = user
    return out


def main():
    out = {"ok": True, "now": timezone.now().isoformat()}
    try:
        coupon_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    except Exception:
        coupon_id = None
    if not coupon_id:
        out["ok"] = False
        out["error"] = "usage: patch_missing_geo_759_for_coupon.py COUPON_ID"
        print(json.dumps(out))
        return

    code = CouponCode.objects.filter(id=coupon_id).first()
    if not code:
        out["ok"] = False
        out["error"] = f"coupon_not_found:{coupon_id}"
        print(json.dumps(out))
        return

    consumer = getattr(code, "assigned_consumer", None)
    if not consumer:
        out["ok"] = False
        out["error"] = "coupon_has_no_consumer"
        print(json.dumps(out))
        return

    out["code"] = {"id": code.id, "code": code.code, "owner_id": getattr(consumer, "id", None)}

    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    mode = (master.get("geo_mode", {}) or {}).get("759")
    fixed_map = (master.get("geo_fixed", {}) or {}).get("759", {})
    out["config"] = {"geo_mode_759": mode, "geo_fixed_759": fixed_map}

    if str(mode or "").lower() != "fixed":
        out["ok"] = False
        out["error"] = "geo_mode_759_not_fixed"
        print(json.dumps(out))
        return

    # Resolve intended agency recipients for pincode-tier layers
    resolved = _resolve_agency_users(consumer)
    out["resolved"] = {k: {"id": v.id, "username": v.username, "category": v.category} for k, v in resolved.items()}

    sid = str(code.id)
    created = []
    skipped = []

    # Patch missing pincode-tier geo credits only (since higher tiers already exist)
    for label, _category, key in ROLES:
        user = resolved.get(label)
        amt = _q2(fixed_map.get(key, 0))
        if not user or amt <= 0:
            skipped.append({"label": label, "reason": "no_user_or_zero_amount"})
            continue
        exists = WalletTransaction.objects.filter(
            user=user,
            type="COMMISSION_CREDIT",
            source_type="ECOUPON_759",
            source_id=sid,
            meta__layer=label,
        ).exists()
        if exists:
            skipped.append({"label": label, "reason": "tx_exists"})
            continue
        try:
            w = Wallet.get_or_create_for_user(user)
            w.credit(
                amt,
                tx_type="COMMISSION_CREDIT",
                meta={"source": "AUTO_POOL_GEO_FIXED", "layer": label},
                source_type="ECOUPON_759",
                source_id=sid,
            )
            created.append({"label": label, "user_id": user.id, "amount": str(amt)})
        except Exception as e:
            skipped.append({"label": label, "reason": f"credit_error:{type(e).__name__}:{e}"})

    out["created"] = created
    out["skipped"] = skipped

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"patch_geo_759_{sid}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

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
from accounts.models import CustomUser, Wallet, WalletTransaction  # noqa: E402
from business.models import CommissionConfig  # noqa: E402
from coupons.models import CouponCode  # noqa: E402


ROLE_MAP = {
    "Sub Franchise": ("agency_sub_franchise", "sub_franchise"),
    "Pincode": ("agency_pincode", "pincode"),
    "Pincode Coord": ("agency_pincode_coordinator", "pincode_coord"),
}


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
        coupon_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    except Exception:
        coupon_id = None
    if not coupon_id:
        out["ok"] = False
        out["error"] = "missing_coupon_id_arg"
        print(json.dumps(out))
        return

    code = CouponCode.objects.filter(id=coupon_id).first()
    if not code:
        out["ok"] = False
        out["error"] = f"coupon_not_found:{coupon_id}"
        print(json.dumps(out))
        return
    consumer = getattr(code, "assigned_consumer", None)
    out["code"] = {"id": code.id, "code": code.code, "owner_id": getattr(consumer, "id", None)}

    if not consumer:
        out["ok"] = False
        out["error"] = "coupon_has_no_consumer"
        print(json.dumps(out))
        return

    # Load fixed config for 150
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    mode_150 = str(((master.get("geo_mode", {}) or {}).get("150", "")) or "").lower()
    fixed_150 = dict(((master.get("geo_fixed", {}) or {}).get("150", {})) or {})
    out["config"] = {"geo_mode_150": mode_150, "geo_fixed_150": fixed_150}

    if mode_150 != "fixed":
        out["ok"] = False
        out["error"] = "geo_mode_150_not_fixed"
        # still dump current
        pass

    pin = (consumer.pincode or "").strip()
    state = getattr(consumer, "state", None)

    # Resolve recipients for the 3 missing roles identically to production logic
    resolved = {}
    if pin:
        resolved["Sub Franchise"] = CustomUser.objects.filter(
            category="agency_sub_franchise",
            region_assignments__level="pincode",
            region_assignments__pincode=pin,
        ).distinct().first()
        resolved["Pincode"] = CustomUser.objects.filter(
            category="agency_pincode",
            region_assignments__level="pincode",
            region_assignments__pincode=pin,
        ).distinct().first()
        resolved["Pincode Coord"] = CustomUser.objects.filter(
            category="agency_pincode_coordinator",
            region_assignments__level="pincode",
            region_assignments__pincode=pin,
        ).distinct().first()
    else:
        resolved["Sub Franchise"] = None
        resolved["Pincode"] = None
        resolved["Pincode Coord"] = None

    out["resolved"] = {k: brief_user(v) for k, v in resolved.items()}

    created = []
    skipped = []
    sid = str(code.id)
    for label, (category, key) in ROLE_MAP.items():
        user_obj = resolved.get(label)
        amt_src = fixed_150.get(key, 0)
        try:
            amt = Decimal(str(amt_src or 0)).quantize(Decimal("0.01"))
        except Exception:
            amt = Decimal("0.00")

        if not user_obj or amt <= 0:
            skipped.append({"label": label, "reason": "no_user_or_zero_amount"})
            continue

        # Only patch if no existing tx exists for this role/layer
        exists = WalletTransaction.objects.filter(
            user=user_obj,
            type="COMMISSION_CREDIT",
            source_type="ECOUPON_150",
            source_id=sid,
            meta__layer=label,
        ).exists()
        if exists:
            skipped.append({"label": label, "reason": "tx_exists"})
            continue

        # Credit wallet (this applies withholding automatically)
        try:
            w = Wallet.get_or_create_for_user(user_obj)
            meta = {
                "layer": label,
                "source": "AUTO_POOL_GEO_FIXED",
                "package": "150",
                "payer": getattr(consumer, "username", None),
                "patch": True,
            }
            w.credit(
                amt,
                tx_type="COMMISSION_CREDIT",
                meta=meta,
                source_type="ECOUPON_150",
                source_id=sid,
            )
            created.append({"label": label, "user": brief_user(user_obj), "amount": str(amt)})
        except Exception as e:
            skipped.append({"label": label, "reason": f"credit_error:{type(e).__name__}:{e}"})

    out["created"] = created
    out["skipped"] = skipped

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"patch_geo_150_{sid}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

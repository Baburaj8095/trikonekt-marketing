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


def _q2(x):
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def main():
    out = {"ok": True, "now": timezone.now().isoformat()}
    try:
        coupon_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    except Exception:
        coupon_id = None
    if not coupon_id:
        out["ok"] = False
        out["error"] = "usage: patch_missing_direct_self_150_for_coupon.py COUPON_ID"
        print(json.dumps(out))
        return

    code = CouponCode.objects.filter(id=coupon_id).first()
    if not code:
        out["ok"] = False
        out["error"] = f"coupon_not_found:{coupon_id}"
        print(json.dumps(out))
        return

    consumer = getattr(code, "assigned_consumer", None)
    sponsor = getattr(consumer, "registered_by", None) if consumer else None
    out["code"] = {"id": code.id, "code": code.code, "owner_id": getattr(consumer, "id", None)}
    out["consumer_id"] = getattr(consumer, "id", None)
    out["sponsor_id"] = getattr(sponsor, "id", None)

    # Resolve amounts from master.direct_bonus["150"] or commissions.prime_150
    cfg = CommissionConfig.get_solo()
    master = dict(getattr(cfg, "master_commission_json", {}) or {})
    direct_map = dict(master.get("direct_bonus", {}) or {})
    row150 = dict(direct_map.get("150", {}) or {})
    sponsor_amt = _q2(row150.get("sponsor")) if ("sponsor" in row150) else _q2(0)
    self_amt = _q2(row150.get("self")) if ("self" in row150) else _q2(0)

    # Fallback from commissions if top-level not present
    if sponsor_amt <= 0 or self_amt <= 0:
        try:
            commissions = dict(master.get("commissions", {}) or {})
            p150 = dict(commissions.get("prime_150", {}) or {})
            dnode = dict(p150.get("direct", {}) or {})
            if sponsor_amt <= 0 and "sponsor" in dnode:
                sponsor_amt = _q2(dnode.get("sponsor"))
            if self_amt <= 0 and "self" in dnode:
                self_amt = _q2(dnode.get("self"))
        except Exception:
            pass

    out["config_amounts"] = {"sponsor": str(sponsor_amt), "self": str(self_amt)}

    created = []
    skipped = []

    sid = str(code.id)

    # Patch sponsor DIRECT_REF_BONUS (ECOUPON) if missing
    if sponsor and sponsor_amt > 0:
        exists = WalletTransaction.objects.filter(
            user=sponsor,
            type="DIRECT_REF_BONUS",
            source_type="ECOUPON",
            source_id=sid,
        ).exists()
        if exists:
            skipped.append({"type": "DIRECT_REF_BONUS", "reason": "tx_exists"})
        else:
            try:
                w = Wallet.get_or_create_for_user(sponsor)
                w.credit(
                    sponsor_amt,
                    tx_type="DIRECT_REF_BONUS",
                    meta={"source": "ECOUPON_150_PATCH", "coupon_id": sid, "patch": True},
                    source_type="ECOUPON",
                    source_id=sid,
                )
                created.append({"type": "DIRECT_REF_BONUS", "user_id": sponsor.id, "amount": str(sponsor_amt)})
            except Exception as e:
                skipped.append({"type": "DIRECT_REF_BONUS", "reason": f"credit_error:{type(e).__name__}:{e}"})
    else:
        skipped.append({"type": "DIRECT_REF_BONUS", "reason": "no_sponsor_or_zero_amount"})

    # Patch self-bonus (SELF_BONUS_ACTIVE, ECOUPON) if missing
    if consumer and self_amt > 0:
        exists = WalletTransaction.objects.filter(
            user=consumer,
            type="SELF_BONUS_ACTIVE",
            source_type="ECOUPON",
            source_id=sid,
        ).exists()
        if exists:
            skipped.append({"type": "SELF_BONUS_ACTIVE", "reason": "tx_exists"})
        else:
            try:
                w = Wallet.get_or_create_for_user(consumer)
                w.credit(
                    self_amt,
                    tx_type="SELF_BONUS_ACTIVE",
                    meta={"source": "ECOUPON_150_PATCH", "coupon_id": sid, "patch": True},
                    source_type="ECOUPON",
                    source_id=sid,
                )
                created.append({"type": "SELF_BONUS_ACTIVE", "user_id": consumer.id, "amount": str(self_amt)})
            except Exception as e:
                skipped.append({"type": "SELF_BONUS_ACTIVE", "reason": f"credit_error:{type(e).__name__}:{e}"})
    else:
        skipped.append({"type": "SELF_BONUS_ACTIVE", "reason": "no_consumer_or_zero_amount"})

    out["created"] = created
    out["skipped"] = skipped

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"patch_direct_self_150_{sid}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

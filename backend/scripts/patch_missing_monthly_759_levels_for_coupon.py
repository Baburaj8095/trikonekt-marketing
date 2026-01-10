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
from business.services.monthly import _load_monthly_759_runtime_cfg  # noqa: E402


def _q2(x):
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _resolve_upline(user: CustomUser, depth: int):
    chain = []
    cur = user
    seen = set()
    for _ in range(max(0, depth)):
        parent = getattr(cur, "registered_by", None)
        if not parent or parent.id in seen:
            break
        chain.append(parent)
        seen.add(parent.id)
        cur = parent
    return chain


def main():
    out = {"ok": True, "now": timezone.now().isoformat()}
    try:
        coupon_id = int(sys.argv[1]) if len(sys.argv) > 1 else None
    except Exception:
        coupon_id = None
    if not coupon_id:
        out["ok"] = False
        out["error"] = "usage: patch_missing_monthly_759_levels_for_coupon.py COUPON_ID"
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

    # Load strict runtime config for monthly_759
    cfg = CommissionConfig.get_solo()
    runtime = _load_monthly_759_runtime_cfg(cfg)
    levels_q = list(runtime.get("levels_fixed", []) or [])
    depth = min(len(levels_q), 5)

    # Resolve upline L1..L5
    upline = _resolve_upline(consumer, depth=depth)
    sid = str(code.id)

    created = []
    skipped = []

    for idx, recipient in enumerate(upline):
        amt = _q2(levels_q[idx] if idx < len(levels_q) else 0)
        if not recipient or amt <= 0:
            skipped.append({"level": idx + 1, "reason": "no_recipient_or_zero_amount"})
            continue

        exists = WalletTransaction.objects.filter(
            user=recipient,
            type="MONTHLY_759_LEVEL",
            source_type="ECOUPON_759",
            source_id=sid,
            meta__level=idx + 1,
        ).exists()
        if exists:
            skipped.append({"level": idx + 1, "reason": "tx_exists"})
            continue

        try:
            w = Wallet.get_or_create_for_user(recipient)
            w.credit(
                amt,
                tx_type="MONTHLY_759_LEVEL",
                meta={"source": "MONTHLY_759_PATCH", "level": idx + 1, "fixed": True},
                source_type="ECOUPON_759",
                source_id=sid,
            )
            created.append({"level": idx + 1, "user_id": recipient.id, "amount": str(amt)})
        except Exception as e:
            skipped.append({"level": idx + 1, "reason": f"credit_error:{type(e).__name__}:{e}"})

    out["created"] = created
    out["skipped"] = skipped

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"patch_monthly_levels_759_{sid}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

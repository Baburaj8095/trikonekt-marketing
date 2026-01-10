import os
import json
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from accounts.models import CustomUser  # noqa: E402
from coupons.models import CouponCode, AuditTrail, Commission  # noqa: E402
from business.models import CommissionConfig  # noqa: E402


def _safe_dec(x, default="0"):
    try:
        return str(Decimal(str(x)))
    except Exception:
        return default


def _upline_chain(user, depth=6):
    chain = []
    cur = user
    seen = set()
    for _ in range(max(0, depth)):
        parent = getattr(cur, "registered_by", None)
        if not parent or parent.id in seen:
            break
        chain.append({
            "id": parent.id,
            "username": parent.username,
            "role": getattr(parent, "role", None),
            "category": getattr(parent, "category", None),
        })
        seen.add(parent.id)
        cur = parent
    return chain


def pick_latest_150_activation(user):
    # Try latest coupon_activated by this user for value 150
    act = (AuditTrail.objects
           .filter(action="coupon_activated", actor=user, coupon_code__value=Decimal("150"))
           .order_by("-created_at")
           .select_related("coupon_code")
           .first())
    if act and act.coupon_code_id:
        return act.coupon_code
    # Fallback to latest assigned SOLD code by user with value 150
    code = (CouponCode.objects
            .filter(assigned_consumer=user, value=Decimal("150"))
            .order_by("-updated_at", "-created_at")
            .first())
    return code


def main():
    username = os.environ.get("USERNAME") or os.environ.get("USER") or "TR9000000001"
    data = {"ok": True, "username": username}

    user = CustomUser.objects.filter(username__iexact=username).first()
    if not user:
        data["ok"] = False
        data["error"] = f"user_not_found:{username}"
    else:
        data["user"] = {
            "id": user.id,
            "username": user.username,
            "role": getattr(user, "role", None),
            "category": getattr(user, "category", None),
            "registered_by_id": getattr(getattr(user, "registered_by", None), "id", None),
            "registered_by_username": getattr(getattr(user, "registered_by", None), "username", None),
            "pincode": getattr(user, "pincode", None),
        }

        # Resolve a likely code for diagnosis (value 150)
        code = pick_latest_150_activation(user)
        if code:
            data["code"] = {
                "id": code.id,
                "code": code.code,
                "value": _safe_dec(code.value),
                "issued_channel": getattr(code, "issued_channel", None),
                "owner_id": code.assigned_consumer_id,
                "status": code.status,
            }
            cid = code.id

            # Presence of key audits that gate distributions
            keys = [
                "coupon_activate_skipped",
                "coupon_activate_code_not_found",
                "coupon_activate_not_owner",
                "coupon_activate_enqueued",
                "coupon_activated",
                "coupon_matrix_created",
                "coupon_matrix_distributed",
                "prime_150_distributed",
                "prime_150_distribution_failed",
                "monthly_759_distributed",
            ]
            audit_presence = {}
            for k in keys:
                audit_presence[k] = AuditTrail.objects.filter(action=k, coupon_code_id=cid).exists()
            data["audit_presence"] = audit_presence

            # Latest audit rows for this code
            data["audits_for_code"] = list(
                AuditTrail.objects.filter(coupon_code_id=cid).order_by("-created_at").values(
                    "action", "created_at", "notes", "metadata"
                )[:50]
            )

            # Commissions created for this code
            data["commissions_for_code"] = list(
                Commission.objects.filter(coupon_code_id=cid).order_by("-earned_at").values(
                    "id", "recipient_id", "role", "status", "amount", "earned_at", "paid_at"
                )[:50]
            )
        else:
            data["code"] = None
            data["audit_presence"] = {}
            data["audits_for_code"] = []
            data["commissions_for_code"] = []

        # Upline chains (6 for five-matrix, 15 for three-matrix) to check roles that may be skipped
        data["upline5"] = _upline_chain(user, depth=6)
        data["upline15"] = _upline_chain(user, depth=15)

        # CommissionConfig master fields relevant to 150
        cfg = CommissionConfig.get_solo()
        master = dict(getattr(cfg, "master_commission_json", {}) or {})

        direct_all = dict(master.get("direct_bonus", {}) or {})
        products = dict(master.get("products", {}) or {})
        coupon150 = dict(products.get("coupon150", {}) or {})

        cm5 = dict(master.get("consumer_matrix_5", {}) or {})
        cm3 = dict(master.get("consumer_matrix_3", {}) or {})

        data["config_snapshot"] = {
            "direct_bonus.150": direct_all.get("150"),
            "products.coupon150.direct_bonus": coupon150.get("direct_bonus"),
            "five_matrix_levels": getattr(cfg, "five_matrix_levels", None),
            "three_matrix_levels": getattr(cfg, "three_matrix_levels", None),
            "consumer_matrix_5.150.percents": (cm5.get("150") or {}).get("percents"),
            "consumer_matrix_5.150.fixed_amounts": (cm5.get("150") or {}).get("fixed_amounts"),
            "consumer_matrix_3.150.percents": (cm3.get("150") or {}).get("percents"),
            "consumer_matrix_3.150.fixed_amounts": (cm3.get("150") or {}).get("fixed_amounts"),
        }

    # Write file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"diag_user_{username}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

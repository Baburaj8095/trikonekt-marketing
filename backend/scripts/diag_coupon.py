import os
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from coupons.models import CouponCode, AuditTrail, Commission  # noqa: E402
from accounts.models import CustomUser  # noqa: E402


def main():
    try:
        cid = int(os.environ.get("CID", "0"))
    except Exception:
        cid = 0
    try:
        uid = int(os.environ.get("UID", "0"))
    except Exception:
        uid = 0

    data = {"ok": True, "cid": cid, "uid": uid}

    u = CustomUser.objects.filter(id=uid).first() if uid else None
    c = CouponCode.objects.filter(id=cid).first() if cid else None

    data["user"] = {"id": getattr(u, "id", None), "username": getattr(u, "username", None)} if u else None
    data["code"] = {
        "id": getattr(c, "id", None),
        "code": getattr(c, "code", None),
        "value": getattr(c, "value", None),
        "issued_channel": getattr(c, "issued_channel", None),
        "owner_id": getattr(c, "assigned_consumer_id", None),
        "status": getattr(c, "status", None),
    } if c else None

    # Audits around this code and user
    audits_for_code = list(
        AuditTrail.objects.filter(coupon_code_id=cid)
        .order_by("-created_at")
        .values("action", "created_at", "notes", "metadata")[:50]
    ) if cid else []
    data["audits_for_code"] = audits_for_code

    activated_by_user = list(
        AuditTrail.objects.filter(actor_id=uid, action="coupon_activated")
        .order_by("-created_at")
        .values("coupon_code_id", "created_at")[:10]
    ) if uid else []
    data["activated_by_user"] = activated_by_user

    # Specific audits that gate distribution
    keys = [
        "coupon_activate_skipped",
        "coupon_activate_code_not_found",
        "coupon_activate_not_owner",
        "prime_150_distributed",
        "prime_150_distribution_failed",
        "prime_750_distributed",
        "monthly_759_distributed",
        "coupon_matrix_distributed",
        "coupon_matrix_created",
    ]
    data["audit_presence"] = {}
    for k in keys:
        qs = AuditTrail.objects.filter(coupon_code_id=cid, action=k)
        data["audit_presence"][k] = qs.exists()

    # Commissions (if any) linked to the code
    commissions = list(
        Commission.objects.filter(coupon_code_id=cid)
        .order_by("-earned_at")
        .values("id", "recipient_id", "role", "status", "amount", "earned_at", "paid_at")[:50]
    ) if cid else []
    data["commissions_for_code"] = commissions

    # Write to backend/tmp for easy read
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"diag_coupon_{cid}_u{uid}.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

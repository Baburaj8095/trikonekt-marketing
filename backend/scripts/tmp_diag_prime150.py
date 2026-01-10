import os
import json
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from accounts.models import CustomUser  # noqa: E402
from coupons.models import CouponCode, AuditTrail, Commission  # noqa: E402
from jobs.models import BackgroundTask  # noqa: E402


def find_latest_ecoupon_150():
    try:
        qs = (CouponCode.objects
              .filter(issued_channel="e_coupon", value=Decimal("150"), assigned_consumer__isnull=False)
              .order_by("-updated_at", "-created_at"))
        return qs.first()
    except Exception:
        return None


def main():
    out = {"ok": True}
    code = find_latest_ecoupon_150()
    if not code:
        out["ok"] = False
        out["error"] = "no_ecoupon_150_found"
    else:
        out["code"] = {
            "id": code.id,
            "code": code.code,
            "value": str(code.value),
            "status": code.status,
            "owner_id": code.assigned_consumer_id,
            "issued_channel": getattr(code, "issued_channel", None),
        }
        uid = code.assigned_consumer_id

        # Enqueue and run activation task (async handler)
        task = BackgroundTask.enqueue(
            task_type="coupon_activate",
            payload={"user_id": int(uid), "type": "150", "source": {"id": code.id, "channel": "e_coupon"}},
            idempotency_key=f"coupon_activate:{uid}:150:{code.id}",
        )
        # Run immediately to simulate worker
        t = BackgroundTask.objects.get(id=task.id)
        t.run()

        out["task"] = {
            "id": t.id,
            "type": t.type,
            "status": t.status,
            "attempts": t.attempts,
            "max_attempts": t.max_attempts,
            "last_error": t.last_error,
            "payload": t.payload,
        }

        # Audit presence for this code
        keys = [
            "coupon_activate_skipped",
            "coupon_activate_code_not_found",
            "coupon_activate_not_owner",
            "coupon_activate_enqueued",
            "coupon_activated",
            "coupon_matrix_distributed",
            "prime_150_distributed",
            "prime_150_distribution_failed",
            "prime_750_distributed",
            "monthly_759_distributed",
        ]
        audit_presence = {k: AuditTrail.objects.filter(action=k, coupon_code_id=code.id).exists() for k in keys}
        out["audits_presence"] = audit_presence

        # Latest audit rows for this code
        out["audits_rows"] = list(
            AuditTrail.objects.filter(coupon_code_id=code.id).order_by("-created_at").values(
                "action", "created_at", "notes", "metadata"
            )[:50]
        )

        # Commissions created for this code
        out["commissions_for_code"] = list(
            Commission.objects.filter(coupon_code_id=code.id).order_by("-earned_at").values(
                "id", "recipient_id", "role", "status", "amount", "earned_at", "paid_at"
            )[:50]
        )

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "prime150_diag.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)

    print(out_path)


if __name__ == "__main__":
    main()

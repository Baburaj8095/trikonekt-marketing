import os
import json

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from jobs.models import BackgroundTask  # noqa: E402
from coupons.models import CouponCode, AuditTrail, Commission  # noqa: E402
from accounts.models import CustomUser  # noqa: E402


def main():
    try:
        task_id = int(os.environ.get("TASK_ID", "133"))
    except Exception:
        task_id = 133

    data = {"ok": True, "task_id": task_id}

    t = BackgroundTask.objects.filter(id=task_id).first()
    if not t:
        latest = list(
            BackgroundTask.objects.filter(type="coupon_activate")
            .order_by("-id")
            .values("id", "status", "scheduled_at", "started_at", "finished_at", "attempts", "last_error")[:5]
        )
        data["error"] = "task_not_found"
        data["latest_coupon_activate"] = latest
    else:
        data["task"] = {
            "id": t.id,
            "type": t.type,
            "status": t.status,
            "attempts": t.attempts,
            "max_attempts": t.max_attempts,
            "scheduled_at": t.scheduled_at.isoformat() if t.scheduled_at else None,
            "started_at": t.started_at.isoformat() if t.started_at else None,
            "finished_at": t.finished_at.isoformat() if t.finished_at else None,
            "last_error": t.last_error,
            "payload": t.payload,
        }

        payload = t.payload or {}
        uid = payload.get("user_id")
        ttype = payload.get("type")
        source = dict(payload.get("source") or {})
        data["payload_parsed"] = {"user_id": uid, "type": ttype, "source": source}

        user = CustomUser.objects.filter(id=uid).first() if uid else None
        data["user"] = {"id": getattr(user, "id", None), "username": getattr(user, "username", None)} if user else None

        code_obj = None
        code_str = str(source.get("code") or "").strip()
        code_id_raw = source.get("id")
        ch = str(source.get("channel") or "").replace("-", "_").lower() if source.get("channel") else ""

        if code_str:
            code_obj = CouponCode.objects.filter(code=code_str).first()
        elif code_id_raw:
            try:
                code_obj = CouponCode.objects.filter(id=int(code_id_raw)).first()
            except Exception:
                code_obj = None

        issued_ch = str(getattr(code_obj, "issued_channel", "") or "").replace("-", "_").lower() if code_obj else ""
        ch_ok = (ch == "e_coupon") or (issued_ch == "e_coupon")
        owner_ok = bool(code_obj and user and code_obj.assigned_consumer_id == user.id)
        try:
            denom_val = str(getattr(code_obj, "value", None))
        except Exception:
            denom_val = None

        data["code"] = {
            "id": getattr(code_obj, "id", None),
            "code": getattr(code_obj, "code", None),
            "issued_channel": issued_ch,
            "assigned_consumer_id": getattr(code_obj, "assigned_consumer_id", None),
            "value": denom_val,
            "channel_in_source": ch,
            "channel_ok": ch_ok,
            "owner_ok": owner_ok,
        }

        # Recent audits
        audits = {}
        if user:
            audits["coupon_activated_by_user"] = list(
                AuditTrail.objects.filter(action="coupon_activated", actor_id=user.id)
                .order_by("-created_at")
                .values("coupon_code_id", "created_at")[:5]
            )
        if code_obj:
            def list_actions(actions):
                out = []
                for a in actions:
                    qs = (
                        AuditTrail.objects.filter(action=a, coupon_code=code_obj)
                        .order_by("-created_at")
                        .values("action", "created_at", "notes", "metadata")[:3]
                    )
                    out.extend(list(qs))
                return out

            audits["for_code"] = list_actions(
                [
                    "coupon_activate_skipped",
                    "coupon_activate_code_not_found",
                    "coupon_activate_not_owner",
                    "prime_150_distributed",
                    "prime_150_distribution_failed",
                    "prime_750_distributed",
                    "monthly_759_distributed",
                    "coupon_matrix_distributed",
                ]
            )
        data["audits"] = audits

        # Commissions linked to this code (if any)
        if code_obj:
            data["commissions_for_code"] = list(
                Commission.objects.filter(coupon_code=code_obj)
                .order_by("-earned_at")
                .values("id", "recipient_id", "role", "status", "amount", "earned_at", "paid_at")[:10]
            )

    # Write diagnostics to file
    out_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp", f"diag_task_{task_id}.json"))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, default=str, indent=2)

    print(out_path)


if __name__ == "__main__":
    main()

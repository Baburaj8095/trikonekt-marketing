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
from accounts.models import WalletTransaction  # noqa: E402
from coupons.models import CouponCode, AuditTrail  # noqa: E402
from jobs.models import BackgroundTask  # noqa: E402


def find_latest_ecoupon_759():
    try:
        return (
            CouponCode.objects.filter(
                issued_channel="e_coupon",
                value=Decimal("759"),
                assigned_consumer__isnull=False,
            )
            .order_by("-created_at", "-id")
            .first()
        )
    except Exception:
        return None


def as_list(qs, fields):
    return list(qs.values(*fields))


def main():
    out = {"ok": True, "now": timezone.now().isoformat()}
    code = find_latest_ecoupon_759()
    if not code:
        out["ok"] = False
        out["error"] = "no_ecoupon_759_found"
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
        try:
            task = BackgroundTask.enqueue(
                task_type="coupon_activate",
                payload={"user_id": int(uid), "type": "759", "source": {"id": code.id, "channel": "e_coupon"}},
                idempotency_key=f"coupon_activate:{uid}:759:{code.id}",
            )
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
        except Exception as e:
            out["task_error"] = f"{type(e).__name__}: {e}"

        # Audits for this code
        keys = [
            "monthly_759_distributed",
            "coupon_activated",
        ]
        out["audits_presence"] = {k: AuditTrail.objects.filter(action=k, coupon_code_id=code.id).exists() for k in keys}
        out["audits_rows"] = as_list(
            AuditTrail.objects.filter(coupon_code_id=code.id).order_by("-created_at")[:50],
            ["action", "created_at", "notes", "metadata"],
        )

        # Wallet transactions evidence:
        # - Direct: MONTHLY_759_DIRECT, source_type="ECOUPON_759"
        # - Levels: MONTHLY_759_LEVEL, source_type="ECOUPON_759"
        # - Geo: COMMISSION_CREDIT, source_type="ECOUPON_759", meta.source startswith AUTO_POOL_GEO
        try:
            sid = str(code.id)

            direct = WalletTransaction.objects.filter(
                type="MONTHLY_759_DIRECT", source_type="ECOUPON_759", source_id=sid
            ).order_by("-created_at")
            level = WalletTransaction.objects.filter(
                type="MONTHLY_759_LEVEL", source_type="ECOUPON_759", source_id=sid
            ).order_by("-created_at")

            geo = WalletTransaction.objects.filter(
                type="COMMISSION_CREDIT", source_type="ECOUPON_759", source_id=sid
            ).order_by("-created_at")

            def brief_tx(qs, limit=50):
                rows = []
                for tx in qs[:limit]:
                    meta = tx.meta or {}
                    rows.append(
                        {
                            "id": tx.id,
                            "user_id": tx.user_id,
                            "amount": str(tx.amount),
                            "type": tx.type,
                            "source_type": tx.source_type,
                            "source_id": tx.source_id,
                            "meta_layer": meta.get("layer"),
                            "meta_source": meta.get("source"),
                            "created_at": tx.created_at.isoformat(),
                        }
                    )
                return rows

            out["direct_count"] = direct.count()
            out["level_count"] = level.count()
            out["geo_count"] = geo.count()
            out["direct_rows"] = brief_tx(direct)
            out["level_rows"] = brief_tx(level)
            geo_limited = [r for r in brief_tx(geo) if str(r.get("meta_source") or "").startswith("AUTO_POOL_GEO")]
            out["geo_rows"] = geo_limited
        except Exception as e:
            out["wallet_scan_error"] = f"{type(e).__name__}: {e}"

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "quick_check_monthly_759.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)

    print(out_path)


if __name__ == "__main__":
    main()

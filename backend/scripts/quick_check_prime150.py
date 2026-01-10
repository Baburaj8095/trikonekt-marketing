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
from accounts.models import CustomUser, WalletTransaction  # noqa: E402
from coupons.models import CouponCode, AuditTrail  # noqa: E402
from jobs.models import BackgroundTask  # noqa: E402


def find_latest_ecoupon_150():
    try:
        return (
            CouponCode.objects.filter(
                issued_channel="e_coupon",
                value=Decimal("150"),
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
        try:
            task = BackgroundTask.enqueue(
                task_type="coupon_activate",
                payload={"user_id": int(uid), "type": "150", "source": {"id": code.id, "channel": "e_coupon"}},
                idempotency_key=f"coupon_activate:{uid}:150:{code.id}",
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
            "prime_150_distributed",
            "prime_150_distribution_failed",
            "coupon_matrix_distributed",
            "monthly_759_distributed",
        ]
        out["audits_presence"] = {k: AuditTrail.objects.filter(action=k, coupon_code_id=code.id).exists() for k in keys}
        out["audits_rows"] = as_list(
            AuditTrail.objects.filter(coupon_code_id=code.id).order_by("-created_at")[:50],
            ["action", "created_at", "notes", "metadata"],
        )

        # Wallet transactions evidence:
        # - Matrix payouts: AUTOPOOL_BONUS_FIVE / AUTOPOOL_BONUS_THREE with source_type="ECOUPON" and source_id=str(code.id)
        # - Geo payouts: COMMISSION_CREDIT with source_type="ECOUPON_150" and meta.source in ["AUTO_POOL_GEO", "AUTO_POOL_GEO_FIXED"]
        try:
            sid = str(code.id)

            five = WalletTransaction.objects.filter(
                type="AUTOPOOL_BONUS_FIVE", source_type="ECOUPON", source_id=sid
            ).order_by("-created_at")
            three = WalletTransaction.objects.filter(
                type="AUTOPOOL_BONUS_THREE", source_type="ECOUPON", source_id=sid
            ).order_by("-created_at")

            geo = WalletTransaction.objects.filter(
                type="COMMISSION_CREDIT", source_type="ECOUPON_150", source_id=sid
            ).order_by("-created_at")

            def brief_tx(qs, limit=20):
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

            out["matrix_five_count"] = five.count()
            out["matrix_three_count"] = three.count()
            out["geo_count"] = geo.count()
            out["matrix_five_rows"] = brief_tx(five)
            out["matrix_three_rows"] = brief_tx(three)
            # Only include geo rows that look like geo payouts (meta.source starts with AUTO_POOL_GEO)
            geo_limited = [r for r in brief_tx(geo, limit=50) if str(r.get("meta_source") or "").startswith("AUTO_POOL_GEO")]
            out["geo_rows"] = geo_limited
        except Exception as e:
            out["wallet_scan_error"] = f"{type(e).__name__}: {e}"

    # Write diagnostics file
    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "quick_check_prime150.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)

    print(out_path)


if __name__ == "__main__":
    main()

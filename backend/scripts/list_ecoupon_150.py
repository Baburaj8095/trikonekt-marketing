import os
import json
from decimal import Decimal

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from coupons.models import CouponCode  # noqa: E402


def rows(qs, fields, limit=20):
    return list(qs.values(*fields)[:limit])


def main():
    out = {}
    try:
        base_qs = CouponCode.objects.filter(value=Decimal("150.00")).order_by("-id")
        out["counts"] = {
            "total_150": base_qs.count(),
            "e_coupon_total": base_qs.filter(issued_channel="e_coupon").count(),
            "e_coupon_assigned_consumer": base_qs.filter(issued_channel="e_coupon", assigned_consumer__isnull=False).count(),
            "e_coupon_available": base_qs.filter(issued_channel="e_coupon", status="AVAILABLE").count(),
            "e_coupon_assigned_agency": base_qs.filter(issued_channel="e_coupon", status="ASSIGNED_AGENCY").count(),
            "e_coupon_assigned_employee": base_qs.filter(issued_channel="e_coupon", status="ASSIGNED_EMPLOYEE").count(),
            "e_coupon_sold": base_qs.filter(issued_channel="e_coupon", status="SOLD").count(),
            "e_coupon_redeemed": base_qs.filter(issued_channel="e_coupon", status="REDEEMED").count(),
        }

        out["latest_assigned_consumer"] = rows(
            base_qs.filter(issued_channel="e_coupon", assigned_consumer__isnull=False)
                   .order_by("-created_at", "-id"),
            ["id", "code", "status", "assigned_consumer_id", "assigned_agency_id", "assigned_employee_id", "issued_channel"],
            limit=20
        )
        out["latest_e_coupon_any"] = rows(
            base_qs.filter(issued_channel="e_coupon").order_by("-created_at", "-id"),
            ["id", "code", "status", "assigned_consumer_id", "assigned_agency_id", "assigned_employee_id", "issued_channel"],
            limit=20
        )
        out["latest_any_150"] = rows(
            base_qs.order_by("-created_at", "-id"),
            ["id", "code", "status", "issued_channel", "assigned_consumer_id", "assigned_agency_id", "assigned_employee_id"],
            limit=20
        )
    except Exception as e:
        out = {"ok": False, "error": f"{type(e).__name__}: {e}"}

    out_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tmp"))
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "list_ecoupon_150.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, default=str, indent=2)
    print(out_path)


if __name__ == "__main__":
    main()

import os
import sys
import json
from pathlib import Path

# Ensure 'backend' is on sys.path so 'core.settings' can be imported
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

def main():
    # Initialize Django
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    import django  # noqa: E402

    django.setup()

    from django.db.models import Q  # noqa: E402
    from accounts.models import CustomUser  # noqa: E402
    from business.models import (  # noqa: E402
        AutoPoolAccount,
        PromoPurchase,
        SubscriptionActivation,
        PromoMonthlyBox,
        is_matrix_eligible,
    )

    usernames = ["9880125300", "9945846318"]
    out = []

    for uname in usernames:
        rec = {"username": uname}
        u = CustomUser.objects.filter(username=uname).first()
        if not u:
            rec["found"] = False
            out.append(rec)
            continue

        rec["found"] = True
        rec["user_id"] = u.id
        rec["category"] = getattr(u, "category", None)
        rec["role"] = getattr(u, "role", None)
        rec["is_staff"] = bool(getattr(u, "is_staff", False))
        rec["is_superuser"] = bool(getattr(u, "is_superuser", False))
        rec["registered_by_id"] = getattr(getattr(u, "registered_by", None), "id", None)
        try:
            rec["is_matrix_eligible"] = bool(is_matrix_eligible(u))
        except Exception:
            rec["is_matrix_eligible"] = None

        # Event counts per multiplicity rules
        p150 = SubscriptionActivation.objects.filter(
            user=u, package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME")
        ).count()
        p750 = (
            PromoPurchase.objects.filter(user=u, status="APPROVED")
            .filter(
                Q(package__code__iexact="PRIME750")
                | Q(package__code__iexact="RS750")
                | Q(package__code__iexact="PRIME_750")
            )
            .count()
        )
        pmb_first = (
            PromoMonthlyBox.objects.filter(user=u)
            .order_by("created_at", "id")
            .values("id", "created_at")
            .first()
        )
        rec["expected_events"] = p150 + p750 + (1 if pmb_first else 0)
        rec["debug"] = {"p150": p150, "p750": p750, "p759_first": bool(pmb_first)}

        # Active accounts in matrices
        five_qs = AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE", owner=u)
        three_qs = AutoPoolAccount.objects.filter(pool_type="THREE_150", status="ACTIVE", owner=u)
        rec["FIVE_ACTIVE"] = five_qs.count()
        rec["THREE_ACTIVE"] = three_qs.count()
        rec["FIVE_sample"] = list(
            five_qs.order_by("created_at", "id").values(
                "id", "level", "parent_account_id", "created_at", "source_type", "source_id"
            )[:10]
        )
        rec["THREE_sample"] = list(
            three_qs.order_by("created_at", "id").values(
                "id", "level", "parent_account_id", "created_at", "source_type", "source_id"
            )[:10]
        )

        # Totals across all statuses and recent REBUILD-created rows (if any)
        rec["FIVE_total"] = AutoPoolAccount.objects.filter(pool_type="FIVE_150", owner=u).count()
        rec["THREE_total"] = AutoPoolAccount.objects.filter(pool_type="THREE_150", owner=u).count()
        rec["REBUILD_new"] = list(
            AutoPoolAccount.objects.filter(owner=u, source_type__startswith="REBUILD_")
            .order_by("-created_at")
            .values("id", "pool_type", "status", "created_at", "source_type", "source_id")[:5]
        )

        out.append(rec)

    # Write to project-root logs with a unique timestamped file and a stable fixed filename
    root = Path(__file__).resolve().parents[2] / "logs"
    root.mkdir(parents=True, exist_ok=True)
    import time as _time
    ts_name = f"users_mx_check_{int(_time.time())}.json"
    out_path = root / ts_name
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    fixed_path = root / "users_mx_check.fixed.json"
    fixed_path.write_text(json.dumps(out, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"WROTE {out_path}")
    print(f"WROTE {fixed_path}")

if __name__ == "__main__":
    main()

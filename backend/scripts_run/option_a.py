"""Production sizing (read-only)

Run with:
  python manage.py shell < scripts_run\option_a.py
"""

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction
from coupons.models import CouponSubmission

print("promo_approved", PromoPurchase.objects.filter(status="APPROVED").count())
print(
    "promo_prime750",
    PromoPurchase.objects.filter(
        status="APPROVED", package__type="PRIME", package__code__icontains="750"
    ).count(),
)
print(
    "promo_monthly",
    PromoPurchase.objects.filter(status="APPROVED", package__type="MONTHLY").count(),
)
print(
    "promo_prime150",
    PromoPurchase.objects.filter(
        status="APPROVED", package__type="PRIME", package__code__icontains="150"
    )
    .exclude(package__code__icontains="750")
    .count(),
)
print(
    "self_250_debits",
    WalletTransaction.objects.filter(
        type="SELF_ACCOUNT_DEBIT", source_type="SELF_250_PACK"
    ).count(),
)
print(
    "ecoupon150",
    CouponSubmission.objects.filter(status="AGENCY_APPROVED", code_ref__value=150).count(),
)
print(
    "autopool_active_5_3",
    AutoPoolAccount.objects.filter(
        status="ACTIVE", pool_type__in=["FIVE_150", "THREE_150"]
    ).count(),
)

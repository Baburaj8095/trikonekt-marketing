"""Audit that purchase-derived seats are balanced between FIVE_150 and THREE_150 per user.

This answers questions like:
  - For each consumer who bought PRIME_750, do they have the same count of seats in FIVE and THREE?
  - For Monthly first-season (Smart SSP) seats, is it paired?
  - For Self Rebirth canonical sources, is it paired?

Run:
  backend\.venv\Scripts\python.exe backend\manage.py shell -c "exec(open('backend/scripts_run/per_user_purchase_balance_audit.py','r',encoding='utf-8').read())"
"""

from django.db.models import Count, Q, F


def summarize(q, label: str, sample: int = 20):
    from business.models import AutoPoolAccount
    from accounts.models import CustomUser

    qs = (
        AutoPoolAccount.objects.filter(status="ACTIVE")
        .filter(q)
        .values("owner_id")
        .annotate(
            five=Count("id", filter=Q(pool_type="FIVE_150")),
            three=Count("id", filter=Q(pool_type="THREE_150")),
        )
        # Compare annotated columns using F() (can't reference python variable `three`).
        .exclude(five=F("three"))
        .order_by("owner_id")
    )

    total = qs.count()
    print(f"\n=== {label} ===")
    print("mismatch_users", total)
    if total == 0:
        return

    owner_ids = [r["owner_id"] for r in qs[: sample * 5]]
    u_map = {
        u.id: u.username
        for u in CustomUser.objects.filter(id__in=owner_ids).only("id", "username")
    }

    for r in qs[:sample]:
        oid = r["owner_id"]
        print(
            {
                "owner_id": oid,
                "username": u_map.get(oid, ""),
                "five": r["five"],
                "three": r["three"],
            }
        )


prime750 = Q(source_type="PRIME_750")
monthly_first = Q(source_type__startswith="MONTHLY_FIRST_SEASON")
self_rebirth = Q(source_type__in=["PRIME_150", "SELF_ACCOUNT_250", "ECOUPON_150_ACTIVATED"])

summarize(prime750, "PRIME_750 per-user (FIVE vs THREE)")
summarize(monthly_first, "MONTHLY_FIRST_SEASON per-user (FIVE vs THREE)")
summarize(self_rebirth, "SELF_REBIRTH canonical per-user (FIVE vs THREE)")


# Cohort: users who have all three categories in at least one pool
from business.models import AutoPoolAccount

prime_users = set(
    AutoPoolAccount.objects.filter(status="ACTIVE", source_type="PRIME_750").values_list(
        "owner_id", flat=True
    )
)
monthly_users = set(
    AutoPoolAccount.objects.filter(
        status="ACTIVE", source_type__startswith="MONTHLY_FIRST_SEASON"
    ).values_list("owner_id", flat=True)
)
rebirth_users = set(
    AutoPoolAccount.objects.filter(
        status="ACTIVE",
        source_type__in=["PRIME_150", "SELF_ACCOUNT_250", "ECOUPON_150_ACTIVATED"],
    ).values_list("owner_id", flat=True)
)

cohort = sorted(list(prime_users & monthly_users & rebirth_users))
print("\n=== Cohort (users having PRIME_750 + MONTHLY_FIRST_SEASON + SELF_REBIRTH) ===")
print("cohort_size", len(cohort))


def summarize_cohort(q, label: str):
    qs = (
        AutoPoolAccount.objects.filter(status="ACTIVE", owner_id__in=cohort)
        .filter(q)
        .values("owner_id")
        .annotate(
            five=Count("id", filter=Q(pool_type="FIVE_150")),
            three=Count("id", filter=Q(pool_type="THREE_150")),
        )
        .exclude(five=F("three"))
    )
    print(label, "mismatch_users", qs.count())


summarize_cohort(prime750, "cohort PRIME_750")
summarize_cohort(monthly_first, "cohort MONTHLY_FIRST_SEASON")
summarize_cohort(self_rebirth, "cohort SELF_REBIRTH")

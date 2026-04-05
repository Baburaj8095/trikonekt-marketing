"""Fast audit: compare expected positions from purchases vs actual matrix positions.

Expected (APPROVED PromoPurchase):
  - PRIME 750: +1 FIVE_150 SUBSCRIPTION_750 and +1 THREE_150 SUBSCRIPTION_750
  - PRIME 150: +1 THREE_150 SELF_REBIRTH
  - MONTHLY (first per season per package): +1 FIVE_150 SMART_SSP and +1 THREE_150 SMART_SSP

Actual (AutoPoolAccount): counts by pool and explicit source_type matching.

Outputs:
  - Prints a compact summary
  - Writes a CSV of all anomalies

Run:
  python manage.py shell --command="exec(open('audit_gaps.py').read())"
"""

import csv
from datetime import datetime
from collections import Counter

from django.db.models import Count, Q, Value, CharField
from django.db.models.functions import Concat, Cast

from accounts.models import CustomUser
from business.models import PromoPurchase, AutoPoolAccount


def qs_to_map(qs, key_field, value_field):
    return {row[key_field]: int(row[value_field] or 0) for row in qs}


# Users to consider (anyone who has at least one matrix position)
user_ids = list(AutoPoolAccount.objects.values_list("owner_id", flat=True).distinct())

# ----------------------------
# Expected counts (from purchases)
# ----------------------------

prime750 = qs_to_map(
    PromoPurchase.objects.filter(
        status="APPROVED",
        user_id__in=user_ids,
        package__type="PRIME",
        package__code__icontains="750",
    )
    .values("user_id")
    .annotate(n=Count("id")),
    "user_id",
    "n",
)

prime150 = qs_to_map(
    PromoPurchase.objects.filter(
        status="APPROVED",
        user_id__in=user_ids,
        package__type="PRIME",
        package__code__icontains="150",
    )
    .exclude(package__code__icontains="750")
    .values("user_id")
    .annotate(n=Count("id")),
    "user_id",
    "n",
)

monthly_seasons = qs_to_map(
    PromoPurchase.objects.filter(
        status="APPROVED",
        user_id__in=user_ids,
        package__type="MONTHLY",
    )
    .annotate(
        season_key=Concat(
            Cast("package_id", CharField()),
            Value(":"),
            Cast("package_number", CharField()),
            output_field=CharField(),
        )
    )
    .values("user_id")
    .annotate(n=Count("season_key", distinct=True)),
    "user_id",
    "n",
)

# ----------------------------
# Actual counts (from AutoPoolAccount)
# ----------------------------

FIVE = "FIVE_150"
THREE = "THREE_150"

q_sub = (
    Q(source_type__icontains="PROMO_PURCHASE")
    | Q(source_type__icontains="PRIME_750")
    | Q(source_type__icontains="SUBSCRIPTION_750")
    | Q(source_type__icontains="BACKFILL_750")
    | Q(source_type__icontains="PROMO_PURCHASE_APPROVAL")
)
q_ssp = (
    Q(source_type__icontains="MONTHLY_759")
    | Q(source_type__icontains="MONTHLY_1000")
    | Q(source_type__icontains="SMART_SSP")
)
q_rebirth = (
    Q(source_type__icontains="ECOUPON")
    | Q(source_type__icontains="COUPON_150")
    | Q(source_type__icontains="BACKFILL_150")
    | Q(source_type__icontains="SELF_250")
    | Q(source_type__icontains="SELF_ACCOUNT")
    | Q(source_type__icontains="SELF_REBIRTH")
)

five_total = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=FIVE)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)
three_total = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=THREE)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)

five_sub = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=FIVE).filter(q_sub)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)
five_ssp = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=FIVE).filter(q_ssp)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)
five_rebirth = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=FIVE).filter(q_rebirth)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)

three_sub = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=THREE).filter(q_sub)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)
three_ssp = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=THREE).filter(q_ssp)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)
three_rebirth = qs_to_map(
    AutoPoolAccount.objects.filter(owner_id__in=user_ids, pool_type=THREE).filter(q_rebirth)
    .values("owner_id")
    .annotate(n=Count("id")),
    "owner_id",
    "n",
)


def get_phone(uid: int) -> str:
    try:
        return CustomUser.objects.only("username").get(id=uid).username
    except Exception:
        return str(uid)


anomalies = []
reasons = Counter()

for uid in user_ids:
    exp_five_sub = prime750.get(uid, 0)
    exp_three_sub = prime750.get(uid, 0)
    exp_three_rebirth = prime150.get(uid, 0)
    exp_five_ssp = monthly_seasons.get(uid, 0)
    exp_three_ssp = monthly_seasons.get(uid, 0)

    exp_five_total = exp_five_sub + exp_five_ssp
    exp_three_total = exp_three_sub + exp_three_ssp + exp_three_rebirth

    act_five_total = five_total.get(uid, 0)
    act_three_total = three_total.get(uid, 0)

    act_five_sub = five_sub.get(uid, 0)
    act_five_ssp = five_ssp.get(uid, 0)
    act_five_rebirth = five_rebirth.get(uid, 0)

    act_three_sub = three_sub.get(uid, 0)
    act_three_ssp = three_ssp.get(uid, 0)
    act_three_rebirth = three_rebirth.get(uid, 0)

    amb_five = max(act_five_total - (act_five_sub + act_five_ssp + act_five_rebirth), 0)
    amb_three = max(act_three_total - (act_three_sub + act_three_ssp + act_three_rebirth), 0)

    notes = []

    if act_five_total < exp_five_total:
        notes.append(f"FIVE missing total: exp={exp_five_total} act={act_five_total}")
    if act_three_total < exp_three_total:
        notes.append(f"THREE missing total: exp={exp_three_total} act={act_three_total}")

    if act_five_sub > exp_five_sub:
        notes.append(f"FIVE SUB750 over-explicit: exp={exp_five_sub} act={act_five_sub}")
    if act_five_ssp > exp_five_ssp:
        notes.append(f"FIVE SSP over-explicit: exp={exp_five_ssp} act={act_five_ssp}")
    if act_five_rebirth > 0:
        notes.append(f"FIVE REBIRTH present: act={act_five_rebirth}")

    if act_three_sub > exp_three_sub:
        notes.append(f"THREE SUB750 over-explicit: exp={exp_three_sub} act={act_three_sub}")
    if act_three_ssp > exp_three_ssp:
        notes.append(f"THREE SSP over-explicit: exp={exp_three_ssp} act={act_three_ssp}")
    if act_three_rebirth > exp_three_rebirth:
        notes.append(f"THREE REBIRTH over-explicit: exp={exp_three_rebirth} act={act_three_rebirth}")

    if exp_five_total == 0 and exp_three_total == 0 and (act_five_total > 0 or act_three_total > 0):
        notes.append("Has matrix positions but no approved purchases")

    if notes:
        phone = get_phone(uid)
        anomalies.append(
            {
                "phone": phone,
                "uid": uid,
                "exp_five": exp_five_total,
                "act_five": act_five_total,
                "amb_five": amb_five,
                "exp_three": exp_three_total,
                "act_three": act_three_total,
                "amb_three": amb_three,
                "notes": "; ".join(notes),
            }
        )
        for n in notes:
            reasons[n.split(":", 1)[0]] += 1


csv_name = f"matrix_gap_audit_{datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')}.csv"
with open(csv_name, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(
        f,
        fieldnames=[
            "phone",
            "uid",
            "exp_five",
            "act_five",
            "amb_five",
            "exp_three",
            "act_three",
            "amb_three",
            "notes",
        ],
    )
    w.writeheader()
    for row in anomalies:
        w.writerow(row)

print(f"Total users with any matrix position: {len(user_ids)}")
print(f"Users with gaps/anomalies: {len(anomalies)}")
print(f"CSV written: {csv_name}\n")

if reasons:
    print("Top anomaly types (users count):")
    for k, v in reasons.most_common(10):
        print(f"  {k}: {v}")
    print("")


def severity(row):
    return abs(row["exp_five"] - row["act_five"]) + abs(row["exp_three"] - row["act_three"])


sample = sorted(anomalies, key=severity, reverse=True)[:25]
if sample:
    print(f"{'Phone':<16} {'ExpF':>5} {'ActF':>5} {'AmbF':>5} | {'ExpT':>5} {'ActT':>5} {'AmbT':>5}  Notes")
    print("-" * 110)
    for r in sample:
        print(
            f"{r['phone']:<16} {r['exp_five']:>5} {r['act_five']:>5} {r['amb_five']:>5} | "
            f"{r['exp_three']:>5} {r['act_three']:>5} {r['amb_three']:>5}  {r['notes']}"
        )

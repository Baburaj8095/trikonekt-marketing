from accounts.models import CustomUser, WalletTransaction
from django.db.models import Sum, Q
from decimal import Decimal as D

u = CustomUser.objects.filter(phone='9999999999').first()

q_layer = (
    Q(type__in=["LEVEL_BONUS", "AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE", "PRIME_150_SELF", "PRIME_750_SELF", "PRIME_759_SELF"]) |
    Q(meta__source__startswith="THREE_MATRIX") |
    Q(meta__source__startswith="FIVE_MATRIX") |
    (Q(source_type="RANK_UPGRADE") & (Q(meta__orig_type__icontains="LEVEL") | Q(type__icontains="LEVEL") | Q(meta__kind__icontains="LEVEL"))) |
    (Q(type="INCOME_CREDIT_75") & (
        Q(meta__orig_type__icontains="LEVEL") |
        Q(meta__orig_type__icontains="AUTOPOOL") |
        Q(meta__source__icontains="MATRIX") |
        Q(meta__trigger__in=["PRIME_150", "PRIME_750", "PRIME_759", "SELF_REBIRTH_250"])
    ))
)
layer_income_all_sources_val = WalletTransaction.objects.filter(user=u, amount__gt=0).filter(q_layer).exclude(
    Q(type__startswith="SELF_ACCOUNT") | Q(meta__ledger="SELF_ACCOUNT")
).aggregate(total=Sum("amount"))["total"] or D("0.00")

print("layer_income_all_sources_val:", layer_income_all_sources_val)

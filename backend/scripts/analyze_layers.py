from accounts.models import CustomUser, WalletTransaction
from django.db.models import Sum, Count, Q
from decimal import Decimal as D

u = CustomUser.objects.filter(phone="9999999999").first()
base_tx = WalletTransaction.objects.filter(user=u).exclude(source_type="ADMIN_SERVICE_CHARGE")

q_five = (
    Q(type="AUTOPOOL_BONUS_FIVE") |
    Q(meta__source__startswith="FIVE_MATRIX") |
    (Q(type="INCOME_CREDIT_75") & (
        Q(meta__source__icontains="FIVE_MATRIX") |
        Q(meta__orig_type="AUTOPOOL_BONUS_FIVE") |
        (Q(meta__trigger__in=["PRIME_750", "PRIME_759", "FIVE_150", "SELF_REBIRTH_250"]) & ~Q(meta__source__icontains="THREE_MATRIX") & ~Q(meta__orig_type="AUTOPOOL_BONUS_THREE"))
    ))
) & ~Q(type__startswith="SELF_ACCOUNT") & ~Q(meta__ledger="SELF_ACCOUNT") & ~Q(meta__source__icontains="THREE_MATRIX") & ~Q(meta__orig_type="AUTOPOOL_BONUS_THREE")

q_three = (
    Q(type="AUTOPOOL_BONUS_THREE") |
    Q(meta__source__startswith="THREE_MATRIX") |
    (Q(type="INCOME_CREDIT_75") & (
        Q(meta__source__icontains="THREE_MATRIX") |
        Q(meta__orig_type="AUTOPOOL_BONUS_THREE") |
        (Q(meta__trigger__in=["PRIME_150", "THREE_150", "SELF_REBIRTH_250"]) & ~Q(meta__source__icontains="FIVE_MATRIX") & ~Q(meta__orig_type="AUTOPOOL_BONUS_FIVE"))
    ))
) & ~Q(type__startswith="SELF_ACCOUNT") & ~Q(meta__ledger="SELF_ACCOUNT") & ~Q(meta__source__icontains="FIVE_MATRIX") & ~Q(meta__orig_type="AUTOPOOL_BONUS_FIVE")

q_e_layer = (
    Q(source_type="RANK_UPGRADE") &
    (Q(meta__kind="RANK_UPGRADE_LEVEL") | Q(meta__orig_type="LEVEL_BONUS") | Q(type="LEVEL_BONUS"))
) & ~Q(type__startswith="SELF_ACCOUNT") & ~Q(meta__ledger="SELF_ACCOUNT")

f_tot = base_tx.filter(q_five, amount__gt=0).aggregate(s=Sum("amount"))["s"] or D(0)
t_tot = base_tx.filter(q_three, amount__gt=0).aggregate(s=Sum("amount"))["s"] or D(0)
e_tot = base_tx.filter(q_e_layer, amount__gt=0).aggregate(s=Sum("amount"))["s"] or D(0)

# Check for any overlaps
overlap_count = base_tx.filter(q_five).filter(q_three).count()

print("5 Blocks Total:", f_tot, "Count:", base_tx.filter(q_five).count())
print("3 Blocks Total:", t_tot, "Count:", base_tx.filter(q_three).count())
print("e-Edu Layer Total:", e_tot, "Count:", base_tx.filter(q_e_layer).count())
print("Overlap between 5 and 3:", overlap_count)
print("Grand Total Layer Income:", f_tot + t_tot + e_tot)

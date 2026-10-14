from accounts.models import CustomUser, WalletTransaction
from django.db.models import Sum, Q, Count
from decimal import Decimal as D
from datetime import datetime, timedelta
from django.utils import timezone
import zoneinfo

u = CustomUser.objects.filter(phone="9999999999").first()
base_tx = WalletTransaction.objects.filter(user=u).exclude(source_type="ADMIN_SERVICE_CHARGE")

try:
    ist = zoneinfo.ZoneInfo("Asia/Kolkata")
except Exception:
    ist = timezone.get_current_timezone()
now_ist = timezone.now().astimezone(ist)

# Test 1: Category filter = FIVE_LAYER
q_five = (
    Q(type="AUTOPOOL_BONUS_FIVE") |
    Q(meta__source__startswith="FIVE_MATRIX") |
    (Q(type="INCOME_CREDIT_75") & (
        Q(meta__source__icontains="FIVE_MATRIX") |
        Q(meta__orig_type="AUTOPOOL_BONUS_FIVE") |
        (Q(meta__trigger__in=["PRIME_750", "PRIME_759", "FIVE_150", "SELF_REBIRTH_250"]) & ~Q(meta__source__icontains="THREE_MATRIX") & ~Q(meta__orig_type="AUTOPOOL_BONUS_THREE"))
    ))
) & ~Q(type__startswith="SELF_ACCOUNT") & ~Q(meta__ledger="SELF_ACCOUNT") & ~Q(meta__source__icontains="THREE_MATRIX") & ~Q(meta__orig_type="AUTOPOOL_BONUS_THREE")

sub = base_tx.filter(q_five)
print("FIVE_LAYER filtered:", sub.count(), sub.filter(amount__gt=0).aggregate(s=Sum("amount"))["s"])

# Test 2: Flow = CREDIT
q_credit = Q(amount__gt=0) & ~Q(type__startswith="SELF_ACCOUNT") & ~Q(meta__ledger="SELF_ACCOUNT")
sub_cred = base_tx.filter(q_credit)
print("CREDIT flow filtered:", sub_cred.count(), sub_cred.aggregate(s=Sum("amount"))["s"])

# Test 3: Flow = DEBIT (Self Account)
q_debit = Q(type__in=["SELF_ACCOUNT_CREDIT", "SELF_ACCOUNT_DEBIT"]) | Q(meta__ledger="SELF_ACCOUNT") | Q(amount__lt=0)
sub_deb = base_tx.filter(q_debit)
print("DEBIT flow filtered:", sub_deb.count(), sub_deb.filter(amount__gt=0).aggregate(s=Sum("amount"))["s"])

# Test 4: Combined Filter: FIVE_LAYER + CREDIT
sub_both = base_tx.filter(q_five & q_credit)
print("FIVE_LAYER + CREDIT:", sub_both.count(), sub_both.aggregate(s=Sum("amount"))["s"])

print("All tests passed!")

import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ[k] = v

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction, FinancialTransaction, LedgerEntry
import datetime

# Check everything created around 2026-09-29 06:20 to 06:30
start = datetime.datetime(2026, 9, 29, 6, 20, tzinfo=datetime.timezone.utc)
end = datetime.datetime(2026, 9, 29, 6, 30, tzinfo=datetime.timezone.utc)

print("FinancialTransactions around 2026-09-29 06:20-06:30:")
for ft in FinancialTransaction.objects.filter(created_at__range=(start, end)):
    print(f"  FT {ft.id}: user={ft.user.username} (id={ft.user_id}), cat={ft.category}, net={ft.net_amount}, dest={ft.destination_module}, ref={ft.transaction_ref}, remarks={ft.remarks}")

print("WalletTransactions around 2026-09-29 06:20-06:30:")
for wt in WalletTransaction.objects.filter(created_at__range=(start, end)):
    print(f"  WT {wt.id}: user={wt.user.username} (id={wt.user_id}), type={wt.type}, amt={wt.amount}, bal_after={wt.balance_after}, meta={wt.meta}")

print("LedgerEntries around 2026-09-29 06:20-06:30:")
for le in LedgerEntry.objects.filter(created_at__range=(start, end)):
    print(f"  LE {le.id}: user={le.user.username}, dir={le.direction}, amt={le.amount}, before={le.balance_before}, after={le.balance_after}, acc={le.wallet_account_id}")

# Check any other vouchers created or redeemed for user 64 or 9743831195
from coupons.models import ConsumerVoucher
for v in ConsumerVoucher.objects.filter(assigned_to_id=64):
    print("Voucher assigned to 64:", v.__dict__)
for v in ConsumerVoucher.objects.filter(redeemed_by_id=64):
    print("Voucher redeemed by 64:", v.__dict__)
for v in ConsumerVoucher.objects.filter(creator_id=64):
    print("Voucher created by 64:", v.__dict__)

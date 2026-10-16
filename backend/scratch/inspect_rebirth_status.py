import sys, os, django

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction
from accounts.models import WalletAccount
from business.models import AutoPoolAccount

u = CustomUser.objects.filter(phone='9999999999').first()
w = Wallet.objects.get(user=u)

print('=== WALLET BALANCES ===')
print(f'Main Balance: ₹{w.main_balance}')
print(f'Self Account Pocket: ₹{w.self_account_balance}')
for wa in WalletAccount.objects.filter(user=u):
    print(f'  Pocket {wa.wallet_type}: ₹{wa.current_balance}')

print('=== REBIRTH IDS IN MATRICES ===')
m5_count = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE_150', source_type='SELF_REBIRTH_250').count()
m3_count = AutoPoolAccount.objects.filter(owner=u, pool_type='THREE_150', source_type='SELF_REBIRTH_250').count()
print(f'5-Matrix Rebirth Seats: {m5_count}')
print(f'3-Matrix Rebirth Seats: {m3_count}')

total_debits = WalletTransaction.objects.filter(user=u, type='SELF_ACCOUNT_DEBIT').count()
print(f'Total SELF_ACCOUNT_DEBIT transactions: {total_debits}')

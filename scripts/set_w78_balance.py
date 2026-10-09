import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from decimal import Decimal
from accounts.models import Wallet, WalletTransaction

# Set legacy wallet balance exactly to latest transaction balance_after
latest_tx = WalletTransaction.objects.filter(user_id=78).order_by('-id').first()
w = Wallet.objects.get(user_id=78)
w.balance = latest_tx.balance_after
w.save(update_fields=['balance'])
print(f"Updated Wallet.balance for User 78 to {w.balance}")

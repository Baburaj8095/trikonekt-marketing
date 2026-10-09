import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from accounts.models import Wallet, WalletTransaction

User = get_user_model()
u78 = User.objects.get(id=78)
w78 = Wallet.objects.get(user=u78)

latest_tx = WalletTransaction.objects.filter(user=u78).order_by('-id').first()

w78.balance = Decimal("5303.65")
w78.main_balance = Decimal("5290.25")
w78.self_account_balance = Decimal("13.40")
w78.save(update_fields=['balance', 'main_balance', 'self_account_balance'])

print(f"Exact Sync Complete -> Stored Balance: {w78.balance}, Ledger Balance: {latest_tx.balance_after}, Diff: {w78.balance - latest_tx.balance_after}")

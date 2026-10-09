import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
from accounts.models import Wallet, WalletTransaction, WalletAccount

User = get_user_model()
u78 = User.objects.get(id=78)
w78 = Wallet.objects.get(user=u78)

# Latest transaction
latest_tx = WalletTransaction.objects.filter(user=u78).order_by('-id').first()
print(f"Stored Wallet Balance: {w78.balance}")
print(f"Latest Transaction (#{latest_tx.id}) Balance After: {latest_tx.balance_after}")
print(f"Diff: {w78.balance - latest_tx.balance_after}")

# If we sync w78 to match the latest transaction:
# w78.main_balance = 5290.25
# w78.self_account_balance = 13.40
# w78.balance = 5303.65
# w78.save()

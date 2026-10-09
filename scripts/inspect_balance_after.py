import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from django.contrib.auth import get_user_model
from accounts.models import WalletTransaction, Wallet, WalletAccount

User = get_user_model()
u78 = User.objects.get(id=78)
w78 = Wallet.objects.get(user=u78)

print(f"Stored Legacy Wallet: balance={w78.balance}, main_balance={w78.main_balance}, self_package={w78.self_account_balance}")
print("\nLast 5 WalletTransactions for 9999999999:")
for tx in WalletTransaction.objects.filter(user=u78).order_by('-id')[:5]:
    print(f"TX #{tx.id} | type={tx.type:22s} | amount={tx.amount:7.2f} | balance_after={tx.balance_after} | meta={tx.meta}")

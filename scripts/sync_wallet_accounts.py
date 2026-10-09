import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from decimal import Decimal
from django.contrib.auth import get_user_model
from accounts.models import Wallet, WalletAccount

User = get_user_model()
u78 = User.objects.get(id=78)

# 1. Update legacy Wallet
w = Wallet.objects.get(user=u78)
w.main_balance = Decimal('5290.25')
w.self_account_balance = Decimal('13.40')
w.balance = Decimal('5303.65')
w.save()

# 2. Update double-entry WalletAccount
w_main = WalletAccount.objects.get(id=347)
w_main.current_balance = Decimal('5290.25')
w_main.available_balance = Decimal('5290.25')
w_main.save()

w_self = WalletAccount.objects.get(id=348)
w_self.current_balance = Decimal('13.40')
w_self.available_balance = Decimal('13.40')
w_self.save()

print(f"Legacy Wallet -> balance={w.balance}, main={w.main_balance}, self={w.self_account_balance}")
print(f"WalletAccount Main -> {w_main.current_balance}")
print(f"WalletAccount Self -> {w_self.current_balance}")

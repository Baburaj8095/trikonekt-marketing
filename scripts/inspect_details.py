import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from accounts.models import Wallet, WalletAccount, WalletTransaction
from business.models import AutoPoolAccount
from mlm_ranks.models import RankMatrixRoot

User = get_user_model()

print("--- WALLET ACCOUNTS ---")
for wa in WalletAccount.objects.all():
    fields = {f.name: getattr(wa, f.name) for f in wa._meta.fields}
    print(f"WA ID {wa.id} |", fields)

print("\n--- WALLET TRANSACTIONS ---")
for wt in WalletTransaction.objects.all():
    fields = {f.name: getattr(wt, f.name) for f in wt._meta.fields}
    print(f"TX ID {wt.id} |", fields)

print("\n--- AUTOPOOL ACCOUNTS ---")
for ap in AutoPoolAccount.objects.all():
    fields = {f.name: getattr(ap, f.name) for f in ap._meta.fields}
    print(f"AP ID {ap.id} |", fields)

print("\n--- RANK MATRIX ROOTS ---")
for r in RankMatrixRoot.objects.all():
    fields = {f.name: getattr(r, f.name) for f in r._meta.fields}
    print(f"Root ID {r.id} |", fields)

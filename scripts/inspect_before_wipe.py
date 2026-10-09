import os, sys, django, json
from decimal import Decimal

from accounts.models import CustomUser, Wallet, WalletTransaction, FinancialTransaction
from business.models import AutoPoolAccount, PromoPurchase
from mlm_ranks.models import UserRank, RankUpgrade, UpgradeCommission

print("=== INSPECTING CURRENT USERS BEFORE RESET ===")
users = list(CustomUser.objects.values('id', 'username', 'phone', 'category', 'is_staff', 'is_superuser'))
for u in users:
    print(f"ID={u['id']}, User={u['username']}, Phone={u['phone']}, Category={u['category']}, Staff={u['is_staff']}, Super={u['is_superuser']}")

print(f"Total Users: {len(users)}")
print(f"Total Wallets: {Wallet.objects.count()}")
print(f"Total WalletTransactions: {WalletTransaction.objects.count()}")
print(f"Total FinancialTransactions: {FinancialTransaction.objects.count()}")
print(f"Total AutoPoolAccounts: {AutoPoolAccount.objects.count()}")
print(f"Total PromoPurchases: {PromoPurchase.objects.count()}")
print(f"Total RankUpgrades: {RankUpgrade.objects.count()}")

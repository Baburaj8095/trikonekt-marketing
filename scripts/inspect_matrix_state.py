import sys
import os

env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from decimal import Decimal
from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletAccount, WalletTransaction
from business.models import RootConsumerConfig, AutoPoolAccount, CommissionConfig

print("=== CHECKING MATRIX & ROOT STATUS ===")
rc = RootConsumerConfig.get_solo()
root_user = rc.get_root_user()
print(f"RootConsumerConfig root_user: {root_user.username if root_user else None} (id={getattr(root_user, 'id', None)})")

cfg = CommissionConfig.get_solo()
comp_user = cfg.get_company_user()
print(f"CommissionConfig company_user: {comp_user.username if comp_user else None} (id={getattr(comp_user, 'id', None)})")

print("\n--- Sentinel Roots (parent_account is None) ---")
for a in AutoPoolAccount.objects.filter(parent_account__isnull=True).order_by("id"):
    print(f"ID {a.id}: pool={a.pool_type}, owner={a.owner.username} (user_id={a.owner_id}), pos={a.position}, level={a.level}, source={a.source_type}")

print("\n--- All 3-Matrix Accounts (THREE_150) ---")
for a in AutoPoolAccount.objects.filter(pool_type="THREE_150").order_by("id"):
    parent_owner = a.parent_account.owner.username if a.parent_account else "ROOT"
    parent_id = a.parent_account_id if a.parent_account else "None"
    print(f"ID {a.id}: owner={a.owner.username}, entry_idx={a.user_entry_index}, parent_id={parent_id} ({parent_owner}), pos={a.position}, level={a.level}, source={a.source_type}")

print("\n--- All 5-Matrix Accounts (FIVE_150) ---")
for a in AutoPoolAccount.objects.filter(pool_type="FIVE_150").order_by("id"):
    parent_owner = a.parent_account.owner.username if a.parent_account else "ROOT"
    parent_id = a.parent_account_id if a.parent_account else "None"
    print(f"ID {a.id}: owner={a.owner.username}, entry_idx={a.user_entry_index}, parent_id={parent_id} ({parent_owner}), pos={a.position}, level={a.level}, source={a.source_type}")

print("\n--- Company Overhead User Transactions & Washout Status ---")
if comp_user:
    tx_count = WalletTransaction.objects.filter(user=comp_user).count()
    cutoff = timezone.now() - timezone.timedelta(hours=24)
    recent_tx = WalletTransaction.objects.filter(user=comp_user, created_at__gte=cutoff).count()
    older_tx = WalletTransaction.objects.filter(user=comp_user, created_at__lt=cutoff).count()
    print(f"Company User {comp_user.username}: Total Tx = {tx_count}, Last 24h Tx = {recent_tx}, Older (>24h) Tx = {older_tx}")

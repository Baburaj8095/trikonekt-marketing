import sys, os
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, WalletTransaction
from mlm_ranks.models import UpgradeCommission, RankUpgrade, UserRank
from business.models import Commission

u = CustomUser.objects.filter(username="9999999999").first()
print(f"=== INVESTIGATING USER {u.id} ({u.username}) ===")

# 1. Upgrade Commissions
up_comms = UpgradeCommission.objects.filter(recipient=u)
print(f"\nUpgradeCommission rows for recipient {u.username}: count = {up_comms.count()}")
direct_comm_total = 0
level_comm_total = 0
for c in up_comms:
    print(f"  ID #{c.id} | Type: {c.commission_type} | From User: {getattr(c.origin_user, 'username', None)} | To Rank: L{getattr(c.target_rank, 'level_number', None)} | Gross: {c.gross_amount} | Net: {c.net_amount} | Status: {c.status}")
    if c.commission_type == "DIRECT":
        direct_comm_total += float(c.net_amount)
    elif c.commission_type == "LEVEL":
        level_comm_total += float(c.net_amount)

print(f"Total UpgradeCommission -> DIRECT (Ref): {direct_comm_total:.2f}, LEVEL (Layer): {level_comm_total:.2f}")

# 2. General Commissions (business.Commission)
b_comms = Commission.objects.filter(recipient=u)
print(f"\nbusiness.Commission rows for recipient {u.username}: count = {b_comms.count()}")
for c in b_comms[:15]:
    print(f"  ID #{c.id} | Kind: {c.kind} | Gross: {c.gross_amount} | Net: {c.net_amount} | Origin: {getattr(c.origin_user, 'username', None)} | Created: {c.created_at}")

# 3. Check WalletTransactions for E-Edu
w_txs = WalletTransaction.objects.filter(wallet__user=u)
print(f"\nWalletTransaction total rows: {w_txs.count()}")
tx_kinds = {}
for tx in w_txs:
    tx_kinds[tx.transaction_type] = tx_kinds.get(tx.transaction_type, 0) + float(tx.amount)
print("WalletTransaction sums by transaction_type:", tx_kinds)

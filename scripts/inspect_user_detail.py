import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction
from mlm_ranks.models import RankUpgrade, UpgradeCommission, CommissionHold, RankMatrixNode, RankMatrixRoot, UserRank, Rank
from business.models import AutoPoolAccount, PromoPurchase

def inspect_user_data(user_id=2):
    user = CustomUser.objects.filter(id=user_id).first()
    if not user:
        print(f"User {user_id} not found")
        return
        
    print(f"=== DETAILED DATA FOR USER {user.username} (ID {user.id}) ===")
    
    # 1. Wallet
    w = Wallet.objects.filter(user=user).first()
    if w:
        print(f"Wallet Balance: {w.balance}")
        print(f"Franchise Earnings: {w.franchise_total_earning}, Active: {w.franchise_active_work}, Inactive: {w.franchise_inactive_work}, Rebirth: {w.franchise_self_rebirth}")
    
    # 2. Wallet Transactions
    txs = WalletTransaction.objects.filter(user=user).order_by("-id")
    print(f"Wallet Transactions count: {txs.count()}")
    for t in txs[:15]:
        print(f"  - TX: Type={t.type}, Amt={t.amount}, BalanceAfter={t.balance_after}, Source={t.source_type}:{t.source_id}")
        
    # 3. UserRank & Upgrades
    ur = UserRank.objects.filter(user=user).first()
    if ur:
        print(f"UserRank: Current Rank={ur.current_rank.rank_name} (L{ur.current_rank.level_number}), Directs={ur.direct_count}, Team={ur.total_team_size}")
        
    upgrades = RankUpgrade.objects.filter(user=user)
    print(f"RankUpgrades count: {upgrades.count()}")
    for up in upgrades:
        print(f"  - Upgrade ID {up.id}: {up.from_rank.rank_name} -> {up.to_rank.rank_name}, Net={up.net_amount}, Status={up.payment_status}")
        
    # 4. UpgradeCommissions
    comms_in = UpgradeCommission.objects.filter(to_user=user)
    print(f"UpgradeCommissions Received count: {comms_in.count()}, Sum={sum(c.commission_amount for c in comms_in)}")
    for c in comms_in:
        from_name = c.from_user.username if c.from_user else 'None'
        print(f"  - In: ID {c.id}, L{c.level} {c.commission_type}, ₹{c.commission_amount}, Status={c.status}, From={from_name}")
        
    comms_out = UpgradeCommission.objects.filter(from_user=user)
    print(f"UpgradeCommissions Sent count: {comms_out.count()}, Sum={sum(c.commission_amount for c in comms_out)}")
    
    # 5. Commission Holds
    holds = CommissionHold.objects.filter(commission__to_user=user)
    print(f"Commission Holds count: {holds.count()}")
    
    # 6. Rank Matrix Nodes & Roots
    roots = RankMatrixRoot.objects.filter(user=user)
    print(f"RankMatrixRoots count: {roots.count()}")
    
    nodes_placed = RankMatrixNode.objects.filter(placed_user=user)
    print(f"RankMatrixNodes (placed_user) count: {nodes_placed.count()}")
    
    nodes_root = RankMatrixNode.objects.filter(root_user=user)
    print(f"RankMatrixNodes (root_user) count: {nodes_root.count()}")
    
    # 7. AutoPool Accounts
    pools = AutoPoolAccount.objects.filter(owner=user)
    print(f"AutoPoolAccounts count: {pools.count()}")
    for p in pools:
        print(f"  - Pool ID {p.id}: {p.pool_type}, Pos={p.position}, Status={p.status}")
        
    # 8. Promo Purchases
    promos = PromoPurchase.objects.filter(user=user)
    print(f"PromoPurchases count: {promos.count()}")
    for pr in promos:
        print(f"  - Promo: {pr.package_type}, Amt={pr.amount}, Status={pr.status}")

if __name__ == "__main__":
    inspect_user_data(2)

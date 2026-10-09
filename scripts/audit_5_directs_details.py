import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase
from mlm_ranks.models import RankUpgrade, UpgradeCommission, RankMatrixNode, RankMatrixRoot, UserRank

def audit_5_directs():
    root = CustomUser.objects.filter(phone="9999999999").first()
    w_root = Wallet.objects.filter(user=root).first()
    
    print("==========================================================================")
    print("COMPREHENSIVE AUDIT REPORT: 5 DIRECT SPONSORS (9999999991 - 9999999995)")
    print("==========================================================================")
    print(f"Root User: {root.username} (ID {root.id})")
    print(f"Root Main Wallet: ₹{w_root.balance}")
    print(f"Root Self Pocket: ₹{w_root.franchise_self_rebirth}")
    print(f"Directs Count in UserRank: {UserRank.objects.filter(user=root).first().direct_count}")
    
    print("\n--- 1. DIRECT MEMBERS & PACKAGE PURCHASES ---")
    direct_phones = ["9999999991", "9999999992", "9999999993", "9999999994", "9999999995"]
    for p in direct_phones:
        u = CustomUser.objects.filter(phone=p).first()
        promos = PromoPurchase.objects.filter(user=u)
        upgrades = RankUpgrade.objects.filter(user=u)
        ap5 = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE_150').first()
        ap3 = AutoPoolAccount.objects.filter(owner=u, pool_type='THREE_150').first()
        rnode = RankMatrixNode.objects.filter(placed_user=u).first()
        
        print(f"\nMember: {u.username} (ID {u.id}) | Sponsor: {u.registered_by.username}")
        print(f"  • Purchases: {promos.count()} Promo Packages (750 Prime + 1000 SPP) + {upgrades.count()} Rank Upgrades (250 e-Edu L1)")
        print(f"  • Tree 1 (5-Matrix): Seat ID {ap5.id if ap5 else 'None'} | Pos: {ap5.position if ap5 else 'None'} | Status: {ap5.status if ap5 else 'None'}")
        print(f"  • Tree 2 (3-Matrix): Seat ID {ap3.id if ap3 else 'None'} | Pos: {ap3.position if ap3 else 'None'} | Status: {ap3.status if ap3 else 'None'}")
        print(f"  • Tree 3 (e-Edu 5M): Node ID {rnode.id if rnode else 'None'} | Pos: {rnode.position if rnode else 'None'} | Depth: {rnode.level_depth if rnode else 'None'} | Parent: {rnode.parent_user.username if rnode else 'None'}")

    print("\n--- 2. ROOT USER (9999999999) COMMISSION TRANSACTIONS ---")
    txs = WalletTransaction.objects.filter(user=root).order_by("id")
    print(f"Total Transactions Generated for Root: {txs.count()}")
    for t in txs:
        print(f"  • TX #{t.id} | Type: {t.type:<22} | Amt: ₹{t.amount:>7.2f} | BalAfter: ₹{t.balance_after:>8.2f} | Source: {t.source_type}:{t.source_id}")

    print("\n--- 3. UPGRADE COMMISSIONS TABLE ---")
    comms = UpgradeCommission.objects.filter(to_user=root).order_by("id")
    print(f"Total Rank Upgrade Commissions to Root: {comms.count()}")
    for c in comms:
        print(f"  • Comm #{c.id} | Level: {c.level} | Type: {c.commission_type} | Amt: ₹{c.commission_amount} | From: {c.from_user.username}")

    print("\n==========================================================================")

if __name__ == "__main__":
    audit_5_directs()

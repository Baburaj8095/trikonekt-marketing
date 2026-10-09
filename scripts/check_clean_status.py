import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction
from mlm_ranks.models import UserRank, RankUpgrade, UpgradeCommission, CommissionHold, RankMatrixNode, RankMatrixRoot

def main():
    u = CustomUser.objects.filter(phone="9999999999").first() or CustomUser.objects.filter(username="9999999999").first()
    w = Wallet.objects.filter(user=u).first() if u else None
    ur = UserRank.objects.filter(user=u).first() if u else None

    print(f"=== LIVE AUDIT FOR USER {u.username} (ID {u.id}) ===")
    print(f"1. Main Wallet Balance:            ₹{w.balance if w else 0}")
    print(f"2. Self Account Pocket (Rebirth):  ₹{w.franchise_self_rebirth if w else 0}")
    print(f"3. Active Work Pocket:             ₹{w.franchise_active_work if w else 0}")
    print(f"4. Wallet Transactions Count:      {WalletTransaction.objects.filter(user=u).count()}")
    print(f"5. Current Rank:                   {ur.current_rank.rank_name if ur else 'None'} (L{ur.current_rank.level_number if ur else 0})")
    print(f"6. Rank Upgrades Count:            {RankUpgrade.objects.filter(user=u).count()}")
    print(f"7. Upgrade Commissions Received:   {UpgradeCommission.objects.filter(to_user=u).count()}")
    print(f"8. Upgrade Commissions Sent:       {UpgradeCommission.objects.filter(from_user=u).count()}")
    print(f"9. Commission Holds Count:         {CommissionHold.objects.filter(commission__to_user=u).count()}")
    print(f"10. Rank Matrix Nodes (placed):    {RankMatrixNode.objects.filter(placed_user=u).count()}")
    print(f"11. Rank Matrix Roots Count:       {RankMatrixRoot.objects.filter(root_user=u).count()}")

    admin = CustomUser.objects.filter(id=1).first()
    admin_w = Wallet.objects.filter(user=admin).first()
    print(f"\n=== COMPANY / OVERFLOW BOX (User ID 1: {admin.username}) ===")
    print(f"1. Admin Main Balance:             ₹{admin_w.balance if admin_w else 0}")
    print(f"2. Admin Transactions Count:       {WalletTransaction.objects.filter(user=admin).count()}")
    print(f"3. Admin Commissions Count:        {UpgradeCommission.objects.filter(to_user=admin).count()}")

if __name__ == "__main__":
    main()

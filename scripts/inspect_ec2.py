import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser, Wallet
from mlm_ranks.models import RankUpgrade, UpgradeCommission, CommissionHold, RankMatrixNode, RankMatrixRoot
from business.models import AutoPoolAccount, CommissionConfig

def main():
    print("=== Wallet Fields ===")
    print([f.name for f in Wallet._meta.fields])

    admin_user = CustomUser.objects.filter(is_superuser=True).first() or CustomUser.objects.filter(id=1).first()
    print(f"\n=== ADMIN USER: ID {admin_user.id} | Username {admin_user.username} ===")
    admin_wallet = Wallet.objects.filter(user=admin_user).first()
    if admin_wallet:
        print(f"Admin Wallet Balance: {admin_wallet.balance}")

    u_test = CustomUser.objects.filter(username="9999999999").first()
    if u_test:
        print(f"\n=== USER 9999999999 (ID {u_test.id}) ===")
        w = Wallet.objects.filter(user=u_test).first()
        if w:
            print(f"User Wallet Balance: {w.balance}, Repurchase: {getattr(w, 'repurchase_balance', getattr(w, 'self_account_balance', 'N/A'))}")
        
        upgrades = RankUpgrade.objects.filter(user=u_test)
        print(f"RankUpgrades count: {upgrades.count()}")
        for up in upgrades:
            print(f"  - Rank {getattr(up.to_rank, 'level_number', None)}: {up.amount_inr}, Status: {up.payment_status}")
            
        comms_rec = UpgradeCommission.objects.filter(to_user=u_test)
        print(f"UpgradeCommissions received count: {comms_rec.count()}, Total: {sum(c.commission_amount for c in comms_rec)}")
        for c in comms_rec:
            print(f"  - Comm: Type={c.commission_type}, Level={c.level}, Amount={c.commission_amount}, Status={c.status}")
            
        pools = AutoPoolAccount.objects.filter(owner=u_test)
        print(f"AutoPoolAccounts: {pools.count()}")
        for p in pools:
            print(f"  - Pool {p.pool_type} (pos {p.position}): {p.status}")

if __name__ == "__main__":
    main()

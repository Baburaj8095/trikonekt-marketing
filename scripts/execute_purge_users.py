import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade, UpgradeCommission

try:
    from accounts.models import ConsumerVoucher
except ImportError:
    ConsumerVoucher = None

try:
    from coupons.models import CouponCode, AuditTrail
except ImportError:
    CouponCode = None
    AuditTrail = None

targets = ['9999999999', '8095918105']

for identifier in targets:
    user = CustomUser.objects.filter(username=identifier).first() or CustomUser.objects.filter(phone=identifier).first()
    if not user:
        print(f"User {identifier} not found, skipping.")
        continue
    
    uid = user.id
    uname = user.username
    print(f"\n==================================================")
    print(f"PURGING ALL PURCHASES & WALLETS FOR: {uname} (ID: {uid})")
    print(f"==================================================")
    
    with transaction.atomic():
        # 1. Safe deletion of AutoPoolAccount (matrix seats)
        user_pools = list(AutoPoolAccount.objects.filter(owner=user))
        pools_count = len(user_pools)
        for pool in user_pools:
            fallback = pool.parent_account
            if not fallback:
                fallback = AutoPoolAccount.objects.filter(
                    pool_type=pool.pool_type, parent_account__isnull=True
                ).exclude(id=pool.id).first()
            if fallback:
                AutoPoolAccount.objects.filter(parent_account=pool).update(parent_account=fallback)
            pool.delete()
        print(f"1. Deleted AutoPoolAccount: {pools_count} nodes removed safely.")

        # 2. PromoMonthlyBox
        d_box = PromoMonthlyBox.objects.filter(user=user).delete()
        print(f"2. Deleted PromoMonthlyBox: {d_box}")

        # 3. PromoPurchase
        d_pur = PromoPurchase.objects.filter(user=user).delete()
        print(f"3. Deleted PromoPurchase: {d_pur}")

        # 4. UpgradeCommission
        d_comm = UpgradeCommission.objects.filter(
            Q(to_user=user) | Q(from_user=user) | Q(upgrade__user=user)
        ).delete()
        print(f"4. Deleted UpgradeCommission: {d_comm}")

        # 5. RankUpgrade
        d_rank = RankUpgrade.objects.filter(user=user).delete()
        print(f"5. Deleted RankUpgrade: {d_rank}")

        # 6. WalletTransaction (direct transactions + sponsor bonus transactions created by this user)
        d_tx = WalletTransaction.objects.filter(user=user).delete()
        d_sp_tx = WalletTransaction.objects.filter(
            Q(meta__from_user_id=uid) | Q(meta__from_user=uname)
        ).delete()
        print(f"6. Deleted WalletTransactions: user={d_tx}, sponsor_from_user={d_sp_tx}")

        # 7. Reset Wallet balances to 0.00
        w = Wallet.objects.filter(user=user).first()
        if w:
            w.balance = Decimal("0.00")
            w.main_balance = Decimal("0.00")
            w.withdrawable_balance = Decimal("0.00")
            w.total_earnings = Decimal("0.00")
            w.total_withdrawn = Decimal("0.00")
            if hasattr(w, "self_account_balance"):
                w.self_account_balance = Decimal("0.00")
            if hasattr(w, "bonus_wallet"):
                w.bonus_wallet = Decimal("0.00")
            w.save()
            print("7. Wallet balances reset to 0.00.")

        # 8. ConsumerVoucher
        if ConsumerVoucher:
            d_cv = ConsumerVoucher.objects.filter(Q(assigned_to=user) | Q(creator=user)).delete()
            print(f"8. Deleted ConsumerVoucher: {d_cv}")

        # 9. CouponCode
        if CouponCode:
            d_cc = CouponCode.objects.filter(Q(assigned_consumer=user) | Q(issued_by=user)).delete()
            print(f"9. Deleted CouponCode: {d_cc}")

        # 10. AuditTrail
        if AuditTrail:
            d_at = AuditTrail.objects.filter(Q(actor=user) | Q(metadata__contains={"user_id": uid})).delete()
            print(f"10. Deleted AuditTrail: {d_at}")

        # 11. Reset User Profile status
        user.account_active = False
        user.is_active = True
        if hasattr(user, "current_rank"):
            user.current_rank = None
        if hasattr(user, "current_rank_id"):
            user.current_rank_id = None
        user.set_password("123456")
        user.save()
        print(f"11. User '{uname}' account_active reset to False, password set to '123456'.")

print("\n=== PURGE COMPLETED SUCCESSFULLY FOR BOTH USERS ===")
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\tmp_purge_users.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/tmp_purge_users.py"
], check=True)

remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/tmp_purge_users.py'"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

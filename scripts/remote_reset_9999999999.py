#!/usr/bin/env python3
import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_script_path = "scripts/tmp_purge_9999999999.py"

remote_code = """import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

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

targets = ['9999999999']

for identifier in targets:
    user = CustomUser.objects.filter(username=identifier).first() or CustomUser.objects.filter(phone=identifier).first()
    if not user:
        print('User ' + identifier + ' not found, skipping.')
        continue
    
    uid = user.id
    uname = user.username
    print('==================================================')
    print('RESETTING 9999999999: ' + uname + ' (ID: ' + str(uid) + ')')
    print('==================================================')
    
    with transaction.atomic():
        # 1. Safe deletion of AutoPoolAccount (matrix seats)
        while True:
            user_leaves = AutoPoolAccount.objects.filter(owner=user).exclude(
                id__in=AutoPoolAccount.objects.exclude(parent_account__isnull=True).values_list('parent_account_id', flat=True)
            )
            count = user_leaves.count()
            if count == 0:
                break
            user_leaves.delete()

        remaining_pools = list(AutoPoolAccount.objects.filter(owner=user))
        pools_count = len(remaining_pools)
        for pool in remaining_pools:
            fallback = pool.parent_account
            if not fallback:
                fallback = AutoPoolAccount.objects.filter(
                    pool_type=pool.pool_type, parent_account__isnull=True
                ).exclude(id=pool.id).first()
            if fallback:
                AutoPoolAccount.objects.filter(parent_account=pool).update(parent_account=fallback)
            pool.delete()
        print('1. Deleted AutoPoolAccount: all matrix seats for user ' + uname + ' removed.')

        # 2. PromoMonthlyBox
        d_box = PromoMonthlyBox.objects.filter(user=user).delete()
        print('2. Deleted PromoMonthlyBox:', d_box)

        # 3. PromoPurchase
        d_pur = PromoPurchase.objects.filter(user=user).delete()
        print('3. Deleted PromoPurchase:', d_pur)

        # 4. UpgradeCommission
        d_comm = UpgradeCommission.objects.filter(
            Q(to_user=user) | Q(from_user=user) | Q(upgrade__user=user)
        ).delete()
        print('4. Deleted UpgradeCommission:', d_comm)

        # 5. RankUpgrade
        d_rank = RankUpgrade.objects.filter(user=user).delete()
        print('5. Deleted RankUpgrade:', d_rank)

        # 6. WalletTransaction
        d_tx = WalletTransaction.objects.filter(user=user).delete()
        d_sp_tx = WalletTransaction.objects.filter(
            Q(meta__from_user_id=uid) | Q(meta__from_user=uname)
        ).delete()
        print('6. Deleted WalletTransactions: user=', d_tx, ', sponsor=', d_sp_tx)

        # 7. Reset Wallet balances to 0.00
        w = Wallet.objects.filter(user=user).first()
        if w:
            w.balance = Decimal('0.00')
            w.main_balance = Decimal('0.00')
            w.withdrawable_balance = Decimal('0.00')
            w.total_earnings = Decimal('0.00')
            w.total_withdrawn = Decimal('0.00')
            if hasattr(w, 'self_account_balance'):
                w.self_account_balance = Decimal('0.00')
            if hasattr(w, 'bonus_wallet'):
                w.bonus_wallet = Decimal('0.00')
            w.save()
            print('7. Wallet balances reset to 0.00.')

        # 8. ConsumerVoucher
        if ConsumerVoucher:
            d_cv = ConsumerVoucher.objects.filter(Q(assigned_to=user) | Q(creator=user)).delete()
            print('8. Deleted ConsumerVoucher:', d_cv)

        # 9. CouponCode
        if CouponCode:
            d_cc = CouponCode.objects.filter(Q(assigned_consumer=user) | Q(issued_by=user)).delete()
            print('9. Deleted CouponCode:', d_cc)

        # 10. AuditTrail
        if AuditTrail:
            d_at = AuditTrail.objects.filter(Q(actor=user) | Q(metadata__contains={'user_id': uid})).delete()
            print('10. Deleted AuditTrail:', d_at)

        # 11. Ensure Consumer Role & clean password
        user.account_active = False
        user.is_active = True
        user.is_staff = False
        user.is_superuser = False
        user.role = 'user'
        user.category = 'consumer'
        if hasattr(user, 'current_rank'):
            user.current_rank = None
        if hasattr(user, 'current_rank_id'):
            user.current_rank_id = None
        user.set_password('123456')
        user.save()
        print('11. User ' + uname + ' configured as Consumer root user, account_active=False, password=123456.')

# Verification
u = CustomUser.objects.filter(username='9999999999').first()
print('--- Verification for 9999999999 ---')
print('Username:', u.username)
print('Role:', u.role)
print('Category:', u.category)
print('Is Active:', u.is_active)
print('Account Active:', u.account_active)
print('Is Superuser / Admin:', u.is_superuser)
print('Matrix Seats count:', AutoPoolAccount.objects.filter(owner=u).count())
print('Purchases count:', PromoPurchase.objects.filter(user=u).count())
print('Rank Upgrades count:', RankUpgrade.objects.filter(user=u).count())
print('==================================================')
"""

with open(remote_script_path, "w", encoding="utf-8") as f:
    f.write(remote_code)

# 1. SCP script to EC2
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    remote_script_path,
    f"{ec2_user}@{ec2_ip}:/tmp/tmp_purge_9999999999.py"
]
subprocess.run(scp_cmd, check=True)

# 2. Execute via SSH
ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "sudo env $(sudo cat /etc/trikonekt/staging-backend.env | xargs) /srv/trikonekt/staging/backend/.venv/bin/python /tmp/tmp_purge_9999999999.py"
]

res = subprocess.run(ssh_cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("ERR:", res.stderr)

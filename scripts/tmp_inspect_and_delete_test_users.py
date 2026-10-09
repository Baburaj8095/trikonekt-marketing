import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

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

# Find users 101, 102, 103, 104, 105 or 0000000101..105 or Trikonekt101..105
test_users = list(CustomUser.objects.filter(
    Q(username__icontains='101') | Q(username__icontains='102') | Q(username__icontains='103') | Q(username__icontains='104') | Q(username__icontains='105') |
    Q(phone__in=['0000000101', '0000000102', '0000000103', '0000000104', '0000000105']) |
    Q(username__in=['0000000101', '0000000102', '0000000103', '0000000104', '0000000105'])
))

print('Found test users matching 101..105:')
for u in test_users:
    print(' - ID:', u.id, 'Username:', u.username, 'Phone:', u.phone, 'Full Name:', u.full_name, 'Sponsor:', u.registered_by_id)

with transaction.atomic():
    for user in test_users:
        uid = user.id
        uname = user.username
        print('Deleting user:', uname, 'ID:', uid)
        
        # 1. Delete AutoPoolAccount
        while True:
            user_leaves = AutoPoolAccount.objects.filter(owner=user).exclude(
                id__in=AutoPoolAccount.objects.exclude(parent_account__isnull=True).values_list('parent_account_id', flat=True)
            )
            if user_leaves.count() == 0:
                break
            user_leaves.delete()
        for pool in list(AutoPoolAccount.objects.filter(owner=user)):
            fallback = pool.parent_account
            if fallback:
                AutoPoolAccount.objects.filter(parent_account=pool).update(parent_account=fallback)
            pool.delete()
            
        # 2. PromoMonthlyBox
        PromoMonthlyBox.objects.filter(user=user).delete()
        # 3. PromoPurchase
        PromoPurchase.objects.filter(user=user).delete()
        # 4. UpgradeCommission
        UpgradeCommission.objects.filter(Q(to_user=user) | Q(from_user=user) | Q(upgrade__user=user)).delete()
        # 5. RankUpgrade
        RankUpgrade.objects.filter(user=user).delete()
        # 6. WalletTransaction
        WalletTransaction.objects.filter(Q(user=user) | Q(meta__from_user_id=uid) | Q(meta__from_user=uname)).delete()
        # 7. Wallet
        Wallet.objects.filter(user=user).delete()
        # 8. ConsumerVoucher
        if ConsumerVoucher:
            ConsumerVoucher.objects.filter(Q(assigned_to=user) | Q(creator=user)).delete()
        # 9. CouponCode
        if CouponCode:
            CouponCode.objects.filter(Q(assigned_consumer=user) | Q(issued_by=user)).delete()
        # 10. AuditTrail
        if AuditTrail:
            AuditTrail.objects.filter(Q(actor=user) | Q(metadata__contains={'user_id': uid})).delete()
            
        # 11. CustomUser
        user.delete()
        print('Successfully deleted user:', uname)

# Also check 9999999999 direct referrals count
root = CustomUser.objects.filter(username='9999999999').first()
if root:
    directs = list(CustomUser.objects.filter(registered_by=root).values('id', 'username', 'phone', 'full_name', 'account_active'))
    print('--- Remaining Directs for 9999999999 ---')
    print('Total Directs count:', len(directs))
    for d in directs:
        print(' -', d['username'], d['phone'], d['full_name'], 'Active:', d['account_active'])

import os, sys
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from django.db.models import Sum, Q
from accounts.models import WalletTransaction
from decimal import Decimal as D

user = get_user_model().objects.filter(phone='9999999999').first()

dir_eedu = WalletTransaction.objects.filter(
    user=user, amount__gt=0, source_type='RANK_UPGRADE'
).filter(
    Q(meta__kind='RANK_UPGRADE_DIRECT') | Q(meta__orig_type='DIRECT_REF_BONUS')
).exclude(
    Q(type__startswith='SELF_ACCOUNT') | Q(meta__ledger='SELF_ACCOUNT')
).aggregate(total=Sum('amount'))['total'] or D('0.00')

layer_eedu = WalletTransaction.objects.filter(
    user=user, amount__gt=0, source_type='RANK_UPGRADE'
).filter(
    Q(meta__kind='RANK_UPGRADE_LEVEL') | Q(meta__orig_type='LEVEL_BONUS')
).exclude(
    Q(type__startswith='SELF_ACCOUNT') | Q(meta__ledger='SELF_ACCOUNT')
).aggregate(total=Sum('amount'))['total'] or D('0.00')

total_eedu_main = dir_eedu + layer_eedu

dir_eedu_self = WalletTransaction.objects.filter(
    user=user, amount__gt=0, source_type='RANK_UPGRADE'
).filter(
    Q(meta__kind='RANK_UPGRADE_DIRECT') | Q(meta__orig_type='DIRECT_REF_BONUS')
).filter(
    Q(type__startswith='SELF_ACCOUNT') | Q(meta__ledger='SELF_ACCOUNT')
).aggregate(total=Sum('amount'))['total'] or D('0.00')

layer_eedu_self = WalletTransaction.objects.filter(
    user=user, amount__gt=0, source_type='RANK_UPGRADE'
).filter(
    Q(meta__kind='RANK_UPGRADE_LEVEL') | Q(meta__orig_type='LEVEL_BONUS')
).filter(
    Q(type__startswith='SELF_ACCOUNT') | Q(meta__ledger='SELF_ACCOUNT')
).aggregate(total=Sum('amount'))['total'] or D('0.00')

print(f'User: {user.phone}')
print(f'E-Edu Direct Referral Bonus (Main Wallet 75%): {dir_eedu}')
print(f'E-Edu Layer Commission (Main Wallet 75%): {layer_eedu}')
print(f'Total E-Edu Income (Main Wallet 75%): {total_eedu_main}')
print(f'Gross Total E-Edu (Main + Self): {total_eedu_main + dir_eedu_self + layer_eedu_self}')
print(f'E-Edu Self Account (25%): {dir_eedu_self + layer_eedu_self}')

from accounts.models import CustomUser, WalletTransaction
from django.db.models import Sum, Q
from decimal import Decimal as D

u = CustomUser.objects.filter(phone='9999999999').first()
base_tx = WalletTransaction.objects.filter(user=u).exclude(source_type='ADMIN_SERVICE_CHARGE')

q_five = (
    Q(type='AUTOPOOL_BONUS_FIVE') |
    Q(meta__source__startswith='FIVE_MATRIX') |
    (Q(type='INCOME_CREDIT_75') & (Q(meta__source__icontains='FIVE_MATRIX') | Q(meta__orig_type='AUTOPOOL_BONUS_FIVE') | Q(meta__trigger__in=['PRIME_750', 'PRIME_759', 'FIVE_150', 'SELF_REBIRTH_250'])))
) & ~Q(type__startswith='SELF_ACCOUNT') & ~Q(meta__ledger='SELF_ACCOUNT')

q_three = (
    Q(type='AUTOPOOL_BONUS_THREE') |
    Q(meta__source__startswith='THREE_MATRIX') |
    (Q(type='INCOME_CREDIT_75') & (Q(meta__source__icontains='THREE_MATRIX') | Q(meta__orig_type='AUTOPOOL_BONUS_THREE') | Q(meta__trigger__in=['PRIME_150', 'THREE_150'])))
) & ~Q(type__startswith='SELF_ACCOUNT') & ~Q(meta__ledger='SELF_ACCOUNT')

q_e_layer = (
    Q(source_type='RANK_UPGRADE') &
    (Q(meta__kind='RANK_UPGRADE_LEVEL') | Q(meta__orig_type='LEVEL_BONUS') | Q(type='LEVEL_BONUS'))
) & ~Q(type__startswith='SELF_ACCOUNT') & ~Q(meta__ledger='SELF_ACCOUNT')

f_tot = base_tx.filter(q_five, amount__gt=0).aggregate(s=Sum('amount'))['s'] or D(0)
t_tot = base_tx.filter(q_three, amount__gt=0).aggregate(s=Sum('amount'))['s'] or D(0)
e_tot = base_tx.filter(q_e_layer, amount__gt=0).aggregate(s=Sum('amount'))['s'] or D(0)

print('=== ROOT USER (9999999999) DATABASE STATS ===')
print('Five Matrix (5 Blocks):', f_tot)
print('Three Matrix (3 Blocks):', t_tot)
print('E-Edu Layer (e-Edu):', e_tot)
print('Sum of all three:', f_tot + t_tot + e_tot)

# Also check what wallet_me_history returns
from accounts.views import wallet_me_history
from rest_framework.test import APIRequestFactory, force_authenticate
factory = APIRequestFactory()
request = factory.get('/api/accounts/wallet/me/history/')
force_authenticate(request, user=u)
resp = wallet_me_history(request)
data = resp.data
print('\n=== WALLET_ME_HISTORY API RESPONSE ===')
print('layer_matrix_earned:', data.get('layer_matrix_earned'))
print('layer_income_all_sources:', data.get('layer_income_all_sources'))
print('layer_edu_earned:', data.get('layer_edu_earned'))
print('category_stats E_EDU_LAYER:', data.get('category_stats', {}).get('E_EDU_LAYER'))
print('category_stats FIVE_LAYER:', data.get('category_stats', {}).get('FIVE_LAYER'))
print('category_stats THREE_LAYER:', data.get('category_stats', {}).get('THREE_LAYER'))

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from business.models import AutoPoolAccount
from mlm_ranks.models import RankMatrixRoot, RankMatrixNode

User = get_user_model()

u = User.objects.filter(username='9999999999').first()
print('User 9999999999:', u, "id:", u.id if u else None)
if u:
    print('  AutoPoolAccounts:', list(AutoPoolAccount.objects.filter(owner=u).values('id', 'pool_type', 'position', 'parent_account_id', 'status')))
    print('  RankMatrixRoot:', list(RankMatrixRoot.objects.filter(root_user=u).values('id', 'rank__rank_name')))
    print('  RankMatrixNode:', list(RankMatrixNode.objects.filter(placed_user=u).values('id', 'root_user_id', 'parent_user_id', 'position', 'level_depth')))

admin_u = User.objects.filter(username='admin').first()
print('\nAdmin User:', admin_u, "id:", admin_u.id if admin_u else None)
if admin_u:
    print('  Admin AutoPoolAccounts:', list(AutoPoolAccount.objects.filter(owner=admin_u).values('id', 'pool_type', 'position', 'parent_account_id', 'status')))

print('\nTotal AutoPoolAccounts by pool_type:')
for p in ['FIVE_150', 'FIVE_750', 'THREE_150', 'THREE_750']:
    print(p, 'count:', AutoPoolAccount.objects.filter(pool_type=p).count(), 'sample:', list(AutoPoolAccount.objects.filter(pool_type=p).values('id', 'owner__username', 'position', 'parent_account_id')[:5]))

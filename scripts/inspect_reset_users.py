import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"\'')

import django
django.setup()
from django.contrib.auth import get_user_model
from mlm_ranks.models import UserRank, RankUpgrade
from business.models import AutoPoolAccount, PromoPurchase

User = get_user_model()
print("Scanning users where AutoPoolAccount count is 0 (reset or unpurchased) but UserRank exists:")
for ur in UserRank.objects.select_related('user', 'current_rank').all():
    u = ur.user
    pools = AutoPoolAccount.objects.filter(owner=u).count()
    purchases = PromoPurchase.objects.filter(user=u).count()
    upgs = RankUpgrade.objects.filter(user=u).count()
    print(f"User: {u.phone} (ID: {u.id}) | Current UserRank: {ur.current_rank.rank_name} (L{ur.current_rank.level_number}) | Pools: {pools} | Purchases: {purchases} | Upgrades: {upgs} | ActAt: {u.first_purchase_activated_at}")

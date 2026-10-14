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
from mlm_ranks.models import UserRank, RankUpgrade, RankMatrixNode

User = get_user_model()
u999 = User.objects.filter(phone='9999999999').first()
if u999:
    print(f'User: {u999.phone} (ID: {u999.id})')
    print(f'account_active: {u999.account_active}')
    print(f'first_purchase_activated_at: {getattr(u999, "first_purchase_activated_at", None)}')
    ur = UserRank.objects.filter(user=u999).first()
    if ur:
        print(f'UserRank exists: current_rank={ur.current_rank.rank_name} (Level {ur.current_rank.level_number})')
    else:
        print('UserRank does not exist')
    upg_count = RankUpgrade.objects.filter(user=u999).count()
    print(f'RankUpgrade count: {upg_count}')
    node_count = RankMatrixNode.objects.filter(placed_user=u999).count()
    print(f'RankMatrixNode count: {node_count}')

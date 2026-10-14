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

# Scan for all users with 0 pools and 0 purchases but dangling UserRank or first_purchase_activated_at
cleaned_count = 0
for ur in list(UserRank.objects.select_related('user', 'current_rank').all()):
    u = ur.user
    pools = AutoPoolAccount.objects.filter(owner=u).count()
    purchases = PromoPurchase.objects.filter(user=u).count()
    upgs = RankUpgrade.objects.filter(user=u).count()

    # If user has no active purchases, pools, or upgrades, they are in a reset/unpurchased state
    if pools == 0 and purchases == 0 and upgs == 0:
        print(f"Cleaning dangling rank for reset user: {u.phone} (ID: {u.id}) - removing {ur.current_rank.rank_name}")
        ur.delete()
        if u.first_purchase_activated_at is not None or u.account_active is True:
            u.first_purchase_activated_at = None
            u.account_active = False
            u.save(update_fields=['first_purchase_activated_at', 'account_active'])
            print(f"  Cleared first_purchase_activated_at & account_active for {u.phone}")
        cleaned_count += 1

print(f"Total cleaned reset users: {cleaned_count}")

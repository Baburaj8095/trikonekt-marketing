import sys, os
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from business.models import PromoPurchase, AutoPoolAccount

print("=== CURRENT TRIEDUCATION.IN ACTIVATION TIMESTAMPS ===")
active_users = []
for u in CustomUser.objects.filter(category='consumer', account_active=True):
    # Find current activation from trieducation.in:
    # 1. Primary AutoPoolAccount in current tree
    ap = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE_150', user_entry_index=1).first()
    # 2. Or latest approved PRIME750 PromoPurchase
    pp = PromoPurchase.objects.filter(user=u, package__code='PRIME750', status='APPROVED').order_by('-id').first()
    
    act_time = None
    if ap and ap.created_at:
        act_time = ap.created_at
    elif pp and (pp.approved_at or pp.requested_at):
        act_time = pp.approved_at or pp.requested_at
        
    if act_time:
        active_users.append((act_time, u))

active_users.sort(key=lambda x: x[0])

for idx, (act_time, u) in enumerate(active_users, 1):
    print(f"#{idx:2d} | User #{u.id:4d} | Mobile: {u.username:10s} | Trieducation Activation: {act_time} | Old Stamped: {u.first_purchase_activated_at}")

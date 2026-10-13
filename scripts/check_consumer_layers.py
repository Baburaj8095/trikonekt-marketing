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
from mlm_ranks.models import Rank, UserRank, RankUpgrade
from business.models import PromoPurchase, PromoMonthlyBox

print("=== CHECKING ALL ACTIVE CONSUMERS ===")
active_consumers = CustomUser.objects.filter(category='consumer', account_active=True).order_by('first_purchase_activated_at', 'id')
for u in active_consumers:
    ur = UserRank.objects.filter(user=u).first()
    upgs = list(RankUpgrade.objects.filter(user=u, payment_status='SUCCESS').select_related('to_rank').order_by('to_rank__level_number'))
    
    # Calculate highest rank
    highest_lvl = None
    if ur and ur.current_rank:
        highest_lvl = ur.current_rank.level_number
    if upgs:
        upg_max = max(up.to_rank.level_number for up in upgs if up.to_rank)
        if highest_lvl is None or upg_max > highest_lvl:
            highest_lvl = upg_max
            
    # If active consumer but no rank record, is he L1?
    if highest_lvl is None:
        # Check if 2K package / Prime was purchased
        highest_lvl = 1 # By definition, an activated consumer has purchased 2k package (Rank 1 / L1)
        
    print(f"ID #{u.id} | User: {u.username} | Name: {u.first_name} {u.last_name} | Activated: {u.first_purchase_activated_at} | Calc Layer: L{highest_lvl} | UserRank: {ur} | Upgrades: {[up.to_rank.level_number for up in upgs]}")

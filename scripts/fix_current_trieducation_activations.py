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

print("=== RE-STAMPING first_purchase_activated_at WITH CURRENT TRIEDUCATION.IN ACTIVATIONS ===")
all_users = CustomUser.objects.all()
updated_count = 0
cleared_count = 0

for u in all_users:
    # 1. Primary AutoPoolAccount in current tree
    ap = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE_150', user_entry_index=1).first()
    # 2. Or latest approved PRIME750 PromoPurchase
    pp = PromoPurchase.objects.filter(user=u, package__code='PRIME750', status='APPROVED').order_by('-id').first()
    
    current_time = None
    if ap and ap.created_at:
        current_time = ap.created_at
    elif pp and (pp.approved_at or pp.requested_at):
        current_time = pp.approved_at or pp.requested_at
        
    if current_time:
        if u.first_purchase_activated_at != current_time:
            u.first_purchase_activated_at = current_time
            u.save(update_fields=['first_purchase_activated_at'])
            updated_count += 1
            print(f"Updated User #{u.id} ({u.username}) -> current trieducation activation: {current_time}")
    else:
        # User was NOT activated in current trieducation system
        if u.first_purchase_activated_at is not None:
            u.first_purchase_activated_at = None
            u.save(update_fields=['first_purchase_activated_at'])
            cleared_count += 1
            print(f"Cleared old activation timestamp for User #{u.id} ({u.username})")

print(f"\nDone: {updated_count} users updated to current trieducation activation, {cleared_count} old timestamps cleared.")

print("\n=== CURRENT ORDER OF ACTIVATED CONSUMERS ===")
qs = CustomUser.objects.filter(first_purchase_activated_at__isnull=False, category='consumer').order_by('first_purchase_activated_at', 'id')
for idx, u in enumerate(qs, 1):
    print(f"#{idx:2d} | User #{u.id:4d} | Mobile: {u.username:10s} | Activated: {u.first_purchase_activated_at}")

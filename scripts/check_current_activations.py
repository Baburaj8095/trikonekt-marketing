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
from business.models import PromoPurchase, PromoMonthlyBox, AutoPoolAccount

print("=== CHECKING LATEST PROMO PURCHASES & AUTOPOOL FOR ACTIVE USERS ===")
for u in CustomUser.objects.filter(category='consumer', account_active=True).order_by('id'):
    # Check latest Prime PromoPurchase
    latest_pp = PromoPurchase.objects.filter(user=u, package__code__in=['PRIME750', 'MONTHLY759']).order_by('-approved_at', '-id').first()
    # Check earliest Prime PromoPurchase from this current cycle / October 2026
    current_pp = PromoPurchase.objects.filter(user=u, package__code='PRIME750').order_by('-id').first()
    # Check AutoPoolAccount
    ap1 = AutoPoolAccount.objects.filter(owner=u, pool_type='FIVE_150', user_entry_index=1).first()
    
    pp_time = current_pp.approved_at or current_pp.requested_at if current_pp else None
    ap_time = ap1.created_at if ap1 else None
    
    print(f"User #{u.id:4d} ({u.username:10s}) | Stamped: {u.first_purchase_activated_at} | Current PRIME750 PP: {pp_time} | AP FIVE_150 #1: {ap_time}")

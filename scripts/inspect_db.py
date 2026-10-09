import os, sys, django

sys.path.append('/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from business.models import AutoPoolAccount, PromoPackage, CommissionConfig

User = get_user_model()
print('--- USERS ---')
for u in User.objects.all().order_by('id'):
    print(f'User ID={u.id}, username={u.username}, phone={getattr(u, "phone", None)}')

print('--- AUTOPOOLS ---')
for a in AutoPoolAccount.objects.all().order_by('id'):
    print(f'AutoPool ID={a.id}, pool={a.pool_type}, owner={a.owner.username}, source={a.source_type}, index={a.user_entry_index}')

print('--- PACKAGES ---')
for p in PromoPackage.objects.all().order_by('id'):
    print(f'Package: {p.code} - {p.name} - Rs.{p.price}')

cfg = CommissionConfig.get_solo()
print(f'--- COMMISSION CONFIG: tax={cfg.tax_percent}%, sponsor={cfg.direct_sponsor_percent}%, layer={cfg.layer_bonus_percent}% ---')

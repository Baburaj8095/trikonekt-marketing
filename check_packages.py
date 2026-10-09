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

from business.models import PromoPackage, CommissionConfig

print('=== PROMO PACKAGES ===')
for p in PromoPackage.objects.all():
    print(f'ID={p.id} | Code={p.code} | Name={p.name} | Price={p.price} | Type={p.type}')

cfg = CommissionConfig.get_solo()
print('=== COMMISSION CONFIG ===')
print('product_base_amount:', cfg.product_base_amount)
print('direct_bonus_sponsor:', cfg.direct_bonus_sponsor)
print('direct_bonus_self:', cfg.direct_bonus_self)
print('tax_percent:', cfg.tax_percent)

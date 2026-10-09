import os, sys, django
from decimal import Decimal as D
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

# 1. Update PromoPackage
for p in PromoPackage.objects.filter(code__in=['PRIME750', 'PRIME759', 'MONTHLY759']):
    p.price = D("1000.00")
    if '750' in p.name:
        p.name = p.name.replace('750', '1000')
    p.save(update_fields=['price', 'name'])
    print(f'Updated PromoPackage ID {p.id}: {p.name} -> Price ₹{p.price}')

# 2. Update CommissionConfig tax_percent
cfg = CommissionConfig.get_solo()
cfg.tax_percent = D("18.00")
cfg.save(update_fields=['tax_percent', 'updated_at'])
print('Updated CommissionConfig tax_percent=18.00%')

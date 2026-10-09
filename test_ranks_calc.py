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

from mlm_ranks.models import Rank, RankUpgrade
from business.models import CommissionConfig

cfg = CommissionConfig.get_solo()
tax = cfg.tax_percent or 18.0
print(f'Config Tax Percent: {tax}%')

for r in Rank.objects.all().order_by('level_number'):
    fee = float(r.upgrade_amount)
    gst = round(fee * (float(tax) / 100.0), 2)
    net = round(fee - gst, 2)
    sponsor = round(net * 0.50, 2)
    layer = round(net * 0.50, 2)
    print(f'Level {r.level_number} ({r.rank_name}): Fee=Rs.{fee:.2f} | GST({tax}%) = Rs.{gst:.2f} | NetPool(82%) = Rs.{net:.2f} | 50% Sponsor = Rs.{sponsor:.2f} (Rs.{sponsor*0.75:.2f} MW / Rs.{sponsor*0.25:.2f} SA) | 50% Layer = Rs.{layer:.2f}')

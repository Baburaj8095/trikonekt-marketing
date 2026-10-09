import os, sys, json

if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from mlm_ranks.models import RankUpgrade, UpgradeCommission

u = RankUpgrade.objects.filter(id=7).first()
if u:
    print(f"Upgrade ID:{u.id} User:{u.user_id} From:{u.from_rank} To:{u.to_rank} UpgradeAmt:{u.upgrade_amount} GST:{u.gst_amount} Net:{u.net_amount} Status:{u.payment_status}")
    for c in UpgradeCommission.objects.filter(upgrade_id=u.id):
        print(f"  -> Comm ID:{c.id} Type:{c.commission_type} ToUser:{c.to_user_id} Level:{c.level} Amt:{c.commission_amount} Status:{c.status}")

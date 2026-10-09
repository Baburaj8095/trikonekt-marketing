import os, sys

sys.path.append('/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
from business.models import RootConsumerConfig
User = get_user_model()

u = User.objects.filter(username="admin-consumer").first()
cfg = RootConsumerConfig.get_solo()
with open('/tmp/check_ref.txt', 'w') as out:
    out.write(f"RootConsumerConfig root_user: {cfg.root_user}\n")
    if u:
        out.write(f"admin-consumer has wallets: {u.wallets.count()}\n")
        out.write(f"admin-consumer has autopools: {u.autopool_accounts.count()}\n")

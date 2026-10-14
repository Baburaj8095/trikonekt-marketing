import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"\'')

import django
django.setup()
from django.contrib.auth import get_user_model
from adminapi.serializers import AdminUserNodeSerializer

User = get_user_model()
for p in ['9999999999', '9000000001', '9000000002', '9008420822', '7483362779']:
    u = User.objects.filter(phone=p).first()
    if u:
        ser = AdminUserNodeSerializer(u)
        print(f"Phone: {u.phone} ({u.username}):")
        print(f"  current_rank: {ser.data.get('current_rank')}")
        print(f"  package_buy_date: {ser.data.get('package_buy_date')}")
        print(f"  account_active: {ser.data.get('account_active')}")

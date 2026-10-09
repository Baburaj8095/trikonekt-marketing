
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            if line.strip() and not line.startswith('#') and '=' in line:
                k, v = line.strip().split('=', 1)
                os.environ[k.strip()] = v.strip()
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.test import RequestFactory
from accounts.models import CustomUser
from rest_framework.test import force_authenticate

# Find view for /accounts/wallet/me/history/
from django.urls import resolve
match = resolve('/api/accounts/wallet/me/history/')
print('RESOLVED VIEW FOR /accounts/wallet/me/history/:', match.func)

rf = RequestFactory()
req = rf.get('/api/accounts/wallet/me/history/')
u = CustomUser.objects.get(id=1)
force_authenticate(req, user=u)

try:
    resp = match.func(req)
    import json
    print('STATUS:', resp.status_code)
    print('DATA TOP:', json.dumps(resp.data.get('top', {}), indent=2, default=str))
    print('ALL TRANSACTIONS COUNT:', len(resp.data.get('all_transactions', [])))
    print('SAMPLE TX:', json.dumps(resp.data.get('all_transactions', [])[:4], indent=2, default=str))
except Exception as e:
    import traceback
    traceback.print_exc()

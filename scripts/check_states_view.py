import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.test import RequestFactory
from rest_framework.test import force_authenticate
from business.views_ssv import AdminSSVStatesView
from accounts.models import CustomUser

admin_user = CustomUser.objects.filter(is_superuser=True).first()
rf = RequestFactory()
req = rf.get('/admin/ssv/states/')
force_authenticate(req, user=admin_user)
resp = AdminSSVStatesView.as_view()(req)
print("First 10 states in AdminSSVStatesView:")
for s in resp.data.get('states', [])[:10]:
    print(f"ID {s['id']}: '{s['name']}', accumulated_amount: {s['accumulated_amount']}")

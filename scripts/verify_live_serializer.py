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
from adminapi.serializers import AdminUserNodeSerializer

print("=== VERIFYING LIVE SERIALIZER OUTPUT ===")
qs = CustomUser.objects.filter(category='consumer', account_active=True).order_by('first_purchase_activated_at', 'id')
for u in qs[:10]:
    data = AdminUserNodeSerializer(u).data
    print(f"ID #{u.id:4d} | Mobile: {u.username:10s} | Layer: {data.get('current_rank'):4s} | 2K Activated: {data.get('package_buy_date')}")

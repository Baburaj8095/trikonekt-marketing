import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
u = CustomUser.objects.filter(username="9999999999").first()
print("User 9999999999:")
print("  id:", u.id)
print("  category:", u.category)
print("  role:", u.role)
print("  account_active:", u.account_active)
print("  registered_by:", u.registered_by)
print("  sponsor_id:", getattr(u, 'sponsor_id', None))
print("  prefixed_id:", getattr(u, 'prefixed_id', None))

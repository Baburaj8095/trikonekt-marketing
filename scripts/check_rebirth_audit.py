import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from coupons.models import AuditTrail
from business.models import StateSSVPool
from accounts.models import CustomUser

print("=== REBIRTH AUDITS ===")
for a in AuditTrail.objects.filter(action__icontains="rebirth"):
    print(a.id, a.created_at, a.notes, a.metadata)

print("\n=== USER 1 STATE ===")
u1 = CustomUser.objects.filter(id=1).first()
if u1:
    print(f"User 1: phone={u1.phone}, state={u1.state} (id={getattr(u1, 'state_id', None)})")

print("\n=== STATE POOLS ===")
for p in StateSSVPool.objects.all():
    print(p.id, p.state.name, p.state_id, p.accumulated_amount, p.seed_amount)

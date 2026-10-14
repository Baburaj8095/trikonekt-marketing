import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from business.models import StateSSVPool, AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from locations.models import State
from accounts.models import CustomUser

print("=== ALL KARNATAKA STATES IN DB ===")
for s in State.objects.filter(name__icontains="Karnataka"):
    pool = StateSSVPool.objects.filter(state=s).first()
    acc = pool.accumulated_amount if pool else 0
    tot = pool.total_accumulated() if pool else 0
    print(f"State ID {s.id}: '{s.name}' -> Pool exists: {pool is not None}, accumulated: {acc}, total: {tot}")

print("\n=== ALL STATE SSV POOLS WITH AMOUNT > 0 ===")
for p in StateSSVPool.objects.filter(accumulated_amount__gt=0):
    print(f"State ID {p.state_id} ({p.state.name}): {p.accumulated_amount}")

print("\n=== REBIRTH AUTO POOL ACCOUNTS (SELF REBIRTH) ===")
rebirths = AutoPoolAccount.objects.filter(entry_label__icontains="REBIRTH")
print(f"Total rebirth accounts: {rebirths.count()}")
for r in rebirths:
    u = CustomUser.objects.filter(id=r.owner_id).first()
    print(f"Rebirth Acc ID {r.id}: owner={r.owner_id} ({getattr(u, 'username', '')}), state_id={getattr(u, 'state_id', '')}, pool_type={r.pool_type}")

print("\n=== AUDIT TRAILS FOR SELF REBIRTH ===")
from coupons.models import AuditTrail
for at in AuditTrail.objects.filter(action__icontains="rebirth"):
    print(f"Audit {at.id}: action={at.action}, actor={at.actor_id}, notes={at.notes}, meta={at.metadata}")

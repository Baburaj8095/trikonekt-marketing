import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from business.models import StateSSVPool, AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from accounts.models import CustomUser
from coupons.models import AuditTrail

print("=== ALL AUTO POOL ACCOUNTS ===")
for a in AutoPoolAccount.objects.all():
    print(f"ID {a.id}: owner={a.owner_id}, pool={a.pool_type}, user_entry_index={a.user_entry_index}, source_type={a.source_type}, source_id={a.source_id}")

print("\n=== REBIRTH AUDIT TRAILS ===")
for at in AuditTrail.objects.filter(action__icontains="rebirth"):
    print(f"Audit {at.id}: action={at.action}, actor={at.actor_id}, notes={at.notes}, meta={at.metadata}")

print("\n=== RECENT PURCHASES ===")
for p in PromoPurchase.objects.order_by("-id")[:10]:
    print(f"Purchase {p.id}: user={p.user_id}, pkg={getattr(p.package, 'code', '')}, status={p.status}, created_at={p.created_at}")

print("\n=== TEST CANDIDATES 9999999999 and 8095918105 ===")
for phone in ['9999999999', '8095918105']:
    u = CustomUser.objects.filter(phone=phone).first()
    if u:
        print(f"User {u.id} ({phone}): active={u.is_active}, state={u.state} (id={getattr(u, 'state_id', None)})")
        accs = list(AutoPoolAccount.objects.filter(owner=u).values('id', 'pool_type', 'user_entry_index'))
        purchases = list(PromoPurchase.objects.filter(user=u).values('id', 'status', 'package_id', 'created_at'))
        boxes = list(PromoMonthlyBox.objects.filter(user=u).values('id', 'package_number', 'box_number'))
        print(f"  Accounts: {accs}")
        print(f"  Purchases: {purchases}")
        print(f"  Boxes: {boxes}")

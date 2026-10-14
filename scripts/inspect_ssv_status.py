import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from business.models import StateSSVPool, AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from accounts.models import CustomUser

print("=== STATE SSV POOLS ===")
for p in StateSSVPool.objects.all():
    print(f"State: {p.state.name} (id {p.state.id}), accumulated: {p.accumulated_amount}, seed: {p.seed_amount}, total: {p.total_accumulated()}")

print("\n=== ACTIVE USERS ===")
for u in CustomUser.objects.filter(is_active=True).exclude(role='admin').exclude(is_superuser=True):
    print(f"User {u.id} ({u.username}): state={getattr(u, 'state', None)}, state_id={getattr(u, 'state_id', None)}")

print("\n=== AUTO POOL ACCOUNTS ===")
for a in AutoPoolAccount.objects.all():
    print(f"Account {a.id}: user={a.user_id}, pool_type={a.pool_type}, label={a.entry_label}")

print("\n=== PROMO PURCHASES ===")
for pp in PromoPurchase.objects.all():
    print(f"Purchase {pp.id}: user={pp.user_id}, pkg={getattr(pp.package, 'code', None)}, status={pp.status}")

print("\n=== PROMO MONTHLY BOXES ===")
for b in PromoMonthlyBox.objects.all():
    print(f"Box {b.id}: user={b.user_id}, pkg_num={b.package_number}, box_num={b.box_number}")

import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, Wallet
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox, SSVVoucher, StateSSVPool

print("=== USERS WITH PURCHASES ===")
for p in PromoPurchase.objects.all():
    print(f"Purchase {p.id}: user {p.user_id} ({getattr(p.user, 'username', '')}), pkg: {getattr(p.package, 'code', '')}")

print("\n=== USERS WITH AUTOPOOL ACCOUNTS (EXCLUDING SENTINELS) ===")
for a in AutoPoolAccount.objects.exclude(id__in=[1, 2]):
    print(f"Account {a.id}: owner {a.owner_id} ({getattr(a.owner, 'username', '')}), pool: {a.pool_type}, label: {a.entry_label if hasattr(a, 'entry_label') else ''}")

print("\n=== USERS WITH PROMO MONTHLY BOXES ===")
for b in PromoMonthlyBox.objects.all():
    print(f"Box {b.id}: user {b.user_id} ({getattr(b.user, 'username', '')}), pkg_num: {b.package_number}, box_num: {b.box_number}")

print("\n=== USERS WITH SSV VOUCHERS ===")
for v in SSVVoucher.objects.all():
    print(f"Voucher {v.id}: user {v.user_id}, code: {v.voucher_code}, amt: {v.amount}")

print("\n=== WALLETS WITH BALANCE > 0 ===")
for w in Wallet.objects.filter(balance__gt=0):
    print(f"Wallet user {w.user_id} ({getattr(w.user, 'username', '')}): balance: {w.balance}")

print("\n=== STATE SSV POOLS ===")
for p in StateSSVPool.objects.all():
    if p.accumulated_amount > 0 or p.seed_amount > 0:
        print(f"State {p.state.name} (id {p.state_id}): accumulated: {p.accumulated_amount}, seed: {p.seed_amount}")

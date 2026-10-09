import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script = """
import json
from decimal import Decimal
from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletTransaction
from locations.models import State
from business.models import PromoPurchase, PromoPackage, CommissionConfig
from mlm_ranks.models import Rank, RankUpgrade
from mlm_ranks.services.commission import CommissionDistributor
from business.services.prime import distribute_prime_750_payouts
from business.services.monthly import distribute_monthly_759_payouts
from business.services.franchise import distribute_franchise_benefit

state_kar = State.objects.filter(name__iexact='Karnataka').first() or State.objects.get(id=1)

# Sponsor 9999999999
sp = CustomUser.objects.filter(phone='9999999999').first()

# Consumer 9700000001
u = CustomUser.objects.filter(phone='9700000001').first()

print(f"Consumer: {u.phone} (ID {u.id}) in Pincode {u.pincode}, Sponsor: {sp.phone} (ID {sp.id})")

# Let us check CommissionConfig
cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}
print("\\n--- CommissionConfig Master JSON Extract ---")
print("direct_bonus:", json.dumps(master.get('direct_bonus', {}), indent=2))
print("products 750:", json.dumps(master.get('products', {}).get('750', {}), indent=2))
print("franchise_fixed_json:", json.dumps(getattr(cfg, 'franchise_fixed_json', {}), indent=2))

# Check agencies and their initial balances
agencies = list(CustomUser.objects.filter(phone__startswith='980000000').order_by('phone'))
print("\\nAgencies before fresh 2k test:")
for a in agencies:
    w = Wallet.get_or_create_for_user(a)
    print(f"  {a.phone} ({a.category}): Balance={w.balance}")
"""

if __name__ == "__main__":
    run_remote(script)

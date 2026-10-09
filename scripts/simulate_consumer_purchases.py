import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
import json
from decimal import Decimal
from django.db import transaction
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

# Sponsor (9999999999)
sp, _ = CustomUser.objects.get_or_create(username='9999999999', defaults={
    'phone': '9999999999', 'category': 'consumer', 'role': 'user', 'account_active': True,
    'pincode': '572106', 'state': state_kar
})
sp.account_active = True
sp.save()
Wallet.get_or_create_for_user(sp)

# Test Consumer in target pincode 572106
u_phone = '9700000001'
u = CustomUser.objects.filter(phone=u_phone).first()
if not u:
    u = CustomUser.objects.create(
        phone=u_phone,
        username=u_phone,
        full_name='Test Consumer 572106',
        registered_by=sp,
        category='consumer',
        role='user',
        pincode='572106',
        state=state_kar,
        account_active=True,
        is_active=True,
    )
    u.set_password('Trikonekt@2026!')
    u.save()

Wallet.get_or_create_for_user(u)
print(f"Using Test Consumer: {u.phone} (ID {u.id}) in Pincode {u.pincode}, State {u.state.name}")

agencies = list(CustomUser.objects.filter(phone__startswith='980000000').order_by('phone'))

print("\\n--- 1. Executing ₹2,000 Starter Bundle (Prime 750 + SPP 1,000 + Rank 1 LMS ₹250) ---")

# 1a. Prime 750
pkg750 = PromoPackage.objects.filter(code='PRIME750').first() or PromoPackage.objects.filter(price=750).first()
if not pkg750:
    pkg750 = PromoPackage.objects.create(code='PRIME750', name='Prime Promo 750', type='PRIME', price=Decimal('750.00'), is_active=True)

p_prime = PromoPurchase.objects.create(
    user=u,
    package=pkg750,
    status='APPROVED',
    prime750_choice='REDEEM',
    approved_at=timezone.now(),
)
distribute_prime_750_payouts(u, source={'type': 'PROMO', 'id': p_prime.id})
distribute_franchise_benefit(u, trigger='prime_750', source={'type': 'PROMO', 'id': str(p_prime.id)})

# 1b. SPP 1,000 (Monthly 759)
pkg759 = PromoPackage.objects.filter(code='MONTHLY759').first() or PromoPackage.objects.filter(price=759).first()
if not pkg759:
    pkg759 = PromoPackage.objects.create(code='MONTHLY759', name='Monthly Promo 759', type='MONTHLY', price=Decimal('759.00'), is_active=True)

p_spp = PromoPurchase.objects.create(
    user=u,
    package=pkg759,
    quantity=1,
    status='APPROVED',
    boxes_json=[1],
    approved_at=timezone.now(),
)
distribute_monthly_759_payouts(u, is_first_month=True, source={'type': 'PROMO', 'id': p_spp.id})
distribute_franchise_benefit(u, trigger='spp_1000', source={'type': 'PROMO', 'id': str(p_spp.id)})

# 1c. Rank 1 Upgrade (₹250)
r1 = Rank.objects.filter(level_number=1).first()
if r1:
    ru1 = RankUpgrade.objects.create(
        user=u,
        from_rank=r1,
        to_rank=r1,
        net_amount=Decimal(str(r1.upgrade_amount or 250)),
        payment_status=RankUpgrade.STATUS_SUCCESS,
        upgraded_at=timezone.now(),
    )
    CommissionDistributor.distribute(ru1)
    distribute_franchise_benefit(u, trigger='rank_1', source={'type': 'RANK', 'id': str(ru1.id)})

print("\\nAgency Wallets After ₹2,000 Starter Bundle:")
for a in agencies:
    w = Wallet.get_or_create_for_user(a)
    print(f"  {a.phone} ({a.category}): Total={w.balance}, ActiveWork={w.franchise_active_work}, InactiveWork={w.franchise_inactive_work}, SelfRebirth={w.franchise_self_rebirth}, Marketing={w.franchise_company_marketing}")

print("\\n--- 2. Executing ₹8,000 Super Agent Upgrades (Ranks 2 to 7) ---")
prev_rank = r1
for lvl in range(2, 8):
    rk = Rank.objects.filter(level_number=lvl).first()
    if rk:
        ru = RankUpgrade.objects.create(
            user=u,
            from_rank=prev_rank or rk,
            to_rank=rk,
            net_amount=Decimal(str(rk.upgrade_amount or 0)),
            payment_status=RankUpgrade.STATUS_SUCCESS,
            upgraded_at=timezone.now(),
        )
        CommissionDistributor.distribute(ru)
        distribute_franchise_benefit(u, trigger=f'rank_{lvl}', source={'type': 'RANK', 'id': str(ru.id)})
        prev_rank = rk

print("\\nAgency Wallets After ₹8,000 Upgrades:")
for a in agencies:
    w = Wallet.get_or_create_for_user(a)
    print(f"  {a.phone} ({a.category}): Total={w.balance}, ActiveWork={w.franchise_active_work}, InactiveWork={w.franchise_inactive_work}, SelfRebirth={w.franchise_self_rebirth}, Marketing={w.franchise_company_marketing}")

print("\\n--- 3. Executing ₹40,000 Master Promoter Upgrades (Ranks 8 to 10) ---")
for lvl in range(8, 11):
    rk = Rank.objects.filter(level_number=lvl).first()
    if rk:
        ru = RankUpgrade.objects.create(
            user=u,
            from_rank=prev_rank or rk,
            to_rank=rk,
            net_amount=Decimal(str(rk.upgrade_amount or 0)),
            payment_status=RankUpgrade.STATUS_SUCCESS,
            upgraded_at=timezone.now(),
        )
        CommissionDistributor.distribute(ru)
        distribute_franchise_benefit(u, trigger=f'rank_{lvl}', source={'type': 'RANK', 'id': str(ru.id)})
        prev_rank = rk

print("\\nAgency Wallets After ₹40,000 Master Upgrades:")
for a in agencies:
    w = Wallet.get_or_create_for_user(a)
    print(f"  {a.phone} ({a.category}): Total={w.balance}, ActiveWork={w.franchise_active_work}, InactiveWork={w.franchise_inactive_work}, SelfRebirth={w.franchise_self_rebirth}, Marketing={w.franchise_company_marketing}")

print("\\n--- 4. Self-Rebirth ₹250 Execution for Agencies ---")
# Check self rebirth balance accumulation in agency wallets
for a in agencies:
    w = Wallet.get_or_create_for_user(a)
    print(f"  {a.phone} ({a.category}): Self Rebirth Bucket = ₹{w.franchise_self_rebirth}")
"""

if __name__ == "__main__":
    run_remote(script_content)

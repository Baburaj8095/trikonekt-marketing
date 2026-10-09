import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from accounts.models import CustomUser, Wallet, AgencyRegionAssignment
from business.models import PromoPurchase, SubscriptionActivation, AutoPoolAccount
from mlm_ranks.models import RankUpgrade

u = CustomUser.objects.filter(phone='9700000001').first() or CustomUser.objects.filter(username='9700000001').first()

print('=== 1. USER 9700000001 PURCHASE STATUS ===')
if u:
    print(f"User ID: {u.id} | Phone: {u.phone} | Username: {u.username}")
    print(f"Pincode: '{u.pincode}' | District: '{getattr(u, 'district', None)}' | City: {getattr(u.city, 'name', None)} | State: {getattr(u.state, 'name', None)}")
    print(f"has_prime: {getattr(u, 'has_prime', None)} | account_active: {u.account_active}")
    
    # Check Promo/SPP purchases
    promos = PromoPurchase.objects.filter(user=u)
    print(f"\\nPromo / SPP Purchases ({promos.count()}):")
    for p in promos:
        print(f"  - Package: {p.package.name} (Type: {p.package.type}, Price: {p.package.price}) | Status: {p.status} | RequestedAt: {p.requested_at} | ApprovedAt: {p.approved_at}")
    
    # Check Prime activations
    primes = SubscriptionActivation.objects.filter(user=u)
    print(f"\\nSubscription / Prime Activations ({primes.count()}):")
    for s in primes:
        print(f"  - Plan: {getattr(s, 'plan_name', s.id)} | CreatedAt: {s.created_at}")

    # Check Rank Upgrades
    ranks = RankUpgrade.objects.filter(user=u)
    print(f"\\nRank Upgrades ({ranks.count()}):")
    for r in ranks:
        print(f"  - To Rank: L{r.to_rank.level_number} | Status: {r.payment_status} | Net Amount: {r.net_amount} | UpgradedAt: {r.upgraded_at}")

    # Direct Sponsor
    print('\\n=== 2. DIRECT SPONSOR ===')
    sponsor = getattr(u, 'referred_by', None)
    if sponsor:
        print(f"Sponsor User ID: {sponsor.id} | Username: {sponsor.username} | Phone: {sponsor.phone} | Name: {sponsor.get_full_name()} | Role: {sponsor.role}")
    else:
        print("Direct Sponsor: None (No sponsor set yet)")

    # Geographic Agencies above this user
    print('\\n=== 3. GEOGRAPHIC AGENCIES ABOVE THIS USER ===')
    pin = (u.pincode or '').strip()
    st = u.state
    
    assignments = AgencyRegionAssignment.objects.all().select_related('user', 'state')
    print(f"All Active Agency Assignments in DB ({assignments.count()}):")
    for a in assignments:
        print(f"  - Level: {a.level} | Pin: '{a.pincode}' | State: {getattr(a.state, 'name', None)} | User: {a.user.username} ({a.user.phone}) | Role: {a.user.category}")
    
    from business.services.franchise import _resolve_recipients
    recipients = _resolve_recipients(u)
    print(f"\\nResolved Agency Recipients for User {u.username}:")
    for k, v in recipients.items():
        if v:
            print(f"  - {k.upper()}: {v.username} ({v.phone}) - {v.get_full_name()} [{v.category}]")
        else:
            print(f"  - {k.upper()}: None")

else:
    print("User 9700000001 not found!")
"""

run_remote(code)

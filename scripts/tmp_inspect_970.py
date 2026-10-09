import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

code = """
from accounts.models import CustomUser, Wallet
from business.models import CommissionConfig, AutoPoolAccount
from mlm_ranks.models import RankUpgrade

u = CustomUser.objects.filter(phone='9700000001').first()
if not u:
    u = CustomUser.objects.filter(username='9700000001').first()

print('=== USER 9700000001 DETAILS ===')
if u:
    sponsor = getattr(u, 'referred_by', None)
    print(f"ID: {u.id} | Username: {u.username} | Phone: {u.phone} | Full Name: {u.get_full_name()} | Role: {u.role} | Category: {u.category}")
    print(f"State: {getattr(u.state, 'name', None)} | City: {getattr(u.city, 'name', None)} | Is Active: {u.is_active} | Account Active: {u.account_active}")
    print(f"Sponsor: {sponsor.username if sponsor else None} (Phone: {sponsor.phone if sponsor else None})")
    w = getattr(u, 'wallet', None)
    if w:
        print(f"Wallet Balance: {w.balance} | Self Account: {w.self_account_balance}")
    
    # Check existing ranks
    upgrades = RankUpgrade.objects.filter(user=u, payment_status='SUCCESS').select_related('to_rank')
    print(f"Ranks achieved ({upgrades.count()}):")
    for r in upgrades:
        print(f"  - Level {r.to_rank.level_number}: {getattr(r.to_rank, 'title', None) or getattr(r.to_rank, 'rank_name', str(r.to_rank))} (Net: ₹{r.net_amount}) at {r.upgraded_at}")

    # Check matrix positions
    seats = AutoPoolAccount.objects.filter(owner=u)
    print(f"Matrix Seats ({seats.count()}):")
    for s in seats:
        print(f"  - Pool: {s.pool_type} | Seat #{s.id} | Parent: {s.parent_account_id}")
else:
    print("User 9700000001 not found")
"""

run_remote(code)

import os
import sys
import json

sys.path.insert(0, '/srv/trikonekt/staging/backend')
env_file = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser, WalletTransaction, Wallet
from business.models import PromoPackage, PromoPurchase, AutoPoolAccount
from mlm_ranks.models import Rank, RankUpgrade

u = CustomUser.objects.filter(username='0101010101').first()
if not u:
    print("User 0101010101 not found")
    sys.exit(1)

print(f"USER: {u.username} (ID: {u.id}), Name: {u.full_name}, Sponsor ID: {u.sponsor_id}, Registered By: {u.registered_by}")

# Trace uplines
curr = u
uplines = []
for i in range(1, 15):
    sp = None
    if curr.registered_by:
        sp = curr.registered_by
    elif curr.sponsor_id:
        sp = CustomUser.objects.filter(username=curr.sponsor_id).first()
    if not sp or sp == curr or sp in uplines:
        break
    uplines.append(sp)
    role_str = getattr(sp, "role", "") or ""
    print(f"  Upline Level {i}: {sp.username} ({sp.full_name}) ID={sp.id} Role={role_str} Active={sp.account_active}")
    curr = sp

print("\n================== ALL PURCHASES BY 0101010101 ==================")
pps = PromoPurchase.objects.filter(user=u).order_by('id')
for p in pps:
    print(f"PromoPurchase ID={p.id} Pkg={p.package.name} ({p.package.code}) Price={p.package.price} Qty={p.quantity} Status={p.status} Boxes={p.boxes_json} Choice={p.prime750_choice} Requested={p.requested_at}")

rus = RankUpgrade.objects.filter(user=u).order_by('id')
for r in rus:
    from_lvl = r.from_rank.level_number if r.from_rank else "-"
    to_lvl = r.to_rank.level_number if r.to_rank else "-"
    print(f"RankUpgrade ID={r.id} From={from_lvl} To={to_lvl} NetAmt={r.net_amount} Status={r.payment_status} At={r.created_at}")

print("\n================== AUTOPOOL ACCOUNTS ==================")
aps = AutoPoolAccount.objects.filter(owner=u).order_by('id')
for ap in aps:
    print(f"AutoPool ID={ap.id} PoolType={ap.pool_type} Level={ap.level} Parent={ap.parent_account_id} Pos={ap.position} Status={ap.status}")

print("\n================== RECENT TRANSACTIONS (SINCE 12:54 UTC) ==================")
all_recent_txs = WalletTransaction.objects.filter(created_at__gte='2026-10-01 12:54:00+00:00').order_by('id')
print(f"Total recent transactions across system: {all_recent_txs.count()}")
for t in all_recent_txs:
    m = t.meta or {}
    print(f"TXN #{t.id} | User: {t.user.username:<12} | Amt: {t.amount:>10} | Type: {t.type:<28} | Time: {t.created_at.strftime('%H:%M:%S')}")
    if m:
        print(f"     Meta: {json.dumps(m)}")

print("\n================== SPONSOR WALLET DETAILS ==================")
sp = CustomUser.objects.filter(username='8095918105').first()
if sp:
    w = Wallet.objects.filter(user=sp).first()
    print(f"Sponsor: {sp.username} ({sp.full_name}) ID={sp.id}")
    print(f"  Main Balance: {getattr(w, 'main_balance', 0)}")
    print(f"  Withdrawable Balance: {getattr(w, 'withdrawable_balance', 0)}")
    print(f"  Self Account: {getattr(w, 'self_account_balance', 0)}")
    print(f"  Bonus Wallet: {getattr(w, 'bonus_wallet', 0)}")
    
    sp_txs = WalletTransaction.objects.filter(user=sp, created_at__gte='2026-10-01 12:54:00+00:00').order_by('id')
    print(f"  Recent Transactions Count for Sponsor: {sp_txs.count()}")
    for t in sp_txs:
        print(f"    TXN #{t.id} | Amt: {t.amount:>10} | Type: {t.type:<28} | Meta: {t.meta}")


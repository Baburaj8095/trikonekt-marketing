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
from business.models import PromoPackage, PromoPurchase
from mlm_ranks.models import Rank, RankUpgrade
from django.db.models import Q

u = CustomUser.objects.filter(username='0101010101').first()
sp = CustomUser.objects.filter(username='8095918105').first()

# All transactions where from_user is 0101010101 or meta refers to 0101010101 / ID 69
all_txs = list(WalletTransaction.objects.filter(
    Q(meta__icontains='0101010101') | Q(meta__icontains='"from_user_id": 69') | Q(meta__icontains='"from_user_id": "69"') | Q(user=u) | Q(source_type='RANK_UPGRADE')
).filter(created_at__gte='2026-10-01 12:54:00+00:00').order_by('id'))

print(f"Total transactions related to 0101010101: {len(all_txs)}")

# Group by time/event
# Event 1: Starter 2k (12:54 UTC)
# Event 2: Stage 2 Tranche 1 4750 (13:16 UTC)
# Event 3: SPP Month 2 1000 (13:17 UTC)
# Event 4: Stage 2 Tranche 2 3250 (13:21:24 UTC)
# Event 5: Stage 3 Tranche 1 5000 (13:21:54 UTC)
# Event 6: Stage 3 Tranche 2 10000 (13:21:57 UTC)

events = [
    ("1. ₹2,000 Starter Bundle (PRIME 750 + SPP 1k + Rank 1)", 5683, 5725),
    ("2. ₹4,750 Stage 2 Tranche 1 (Layers 2-5)", 5730, 5770),
    ("3. ₹1,000 SPP Month 2 Box", 5771, 5774),
    ("4. ₹3,250 Stage 2 Tranche 2 (Layers 6-7)", 5775, 5805),
    ("5. ₹5,000 Stage 3 Tranche 1 (Layer 8)", 5806, 5835),
    ("6. ₹10,000 Stage 3 Tranche 2 (Layer 9)", 5836, 5870),
]

for title, start_id, end_id in events:
    sub_txs = [t for t in all_txs if start_id <= t.id <= end_id]
    print(f"\n========================================================")
    print(f"### {title}")
    print(f"========================================================")
    for t in sub_txs:
        m = t.meta or {}
        orig_t = m.get("orig_type") or t.type
        kind = m.get("kind") or ""
        desc = m.get("source") or m.get("trigger") or m.get("product") or ""
        print(f"  TXN #{t.id} | Beneficiary: {t.user.username:<12} | Amt: {float(t.amount):>8.2f} | Type: {orig_t:<25} | Split: {t.type:<20} | Info: {kind} {desc} (Level {m.get('level_index', '-')})")

print("\n========================================================")
print("### TOTAL EARNINGS RECEIVED BY SPONSOR (8095918105)")
print("========================================================")
sp_txs = [t for t in all_txs if t.user == sp]
sp_income_75 = sum(float(t.amount) for t in sp_txs if t.type == "INCOME_CREDIT_75")
sp_self_25 = sum(float(t.amount) for t in sp_txs if t.type == "SELF_ACCOUNT_CREDIT")
sp_direct_bonuses = [t for t in sp_txs if "DIRECT" in str(t.meta)]
print(f"  Sponsor Total Credits from 0101010101: ₹{sp_income_75 + sp_self_25:.2f}")
print(f"    - Main Wallet (75%): ₹{sp_income_75:.2f}")
print(f"    - Self Account (25%): ₹{sp_self_25:.2f}")

print("\nBreakdown of Sponsor Transactions from 0101010101:")
for t in sp_txs:
    m = t.meta or {}
    print(f"  TXN #{t.id} | Amt: ₹{float(t.amount):>7.2f} | Split: {t.type:<20} | Orig: {m.get('orig_type', t.type):<25} | Kind: {m.get('kind', '-')} | Desc: {m.get('source', '')}")

print("\n========================================================")
print("### TOTAL EARNINGS RECEIVED BY UPLINE LEVEL 2 (9999999999 / COMPANY)")
print("========================================================")
up2 = CustomUser.objects.filter(username='9999999999').first()
if up2:
    up2_txs = [t for t in all_txs if t.user == up2]
    up2_total = sum(float(t.amount) for t in up2_txs)
    print(f"  Upline L2 (9999999999) Total Credits: ₹{up2_total:.2f}")
    for t in up2_txs[:15]:
        m = t.meta or {}
        print(f"  TXN #{t.id} | Amt: ₹{float(t.amount):>7.2f} | Type: {t.type} | Orig: {m.get('orig_type', '-')} | Kind: {m.get('kind', '-')}")

print("\n========================================================")
print("### UPGRADE COMMISSION RECORDS (mlm_ranks_upgradecommission)")
print("========================================================")
from mlm_ranks.models import UpgradeCommission
ucs = UpgradeCommission.objects.filter(from_user=u).order_by("id")
print(f"Total UpgradeCommission rows: {ucs.count()}")
for uc in ucs:
    print(f"  UC #{uc.id} | Upgrade #{uc.upgrade_id} (Net: {uc.upgrade.net_amount if uc.upgrade else '-'}) | Beneficiary: {uc.to_user.username:<12} | Amt: ₹{float(uc.commission_amount):>8.2f} | Type: {uc.commission_type:<8} | Status: {uc.status:<10} | Target Level: {uc.level}")


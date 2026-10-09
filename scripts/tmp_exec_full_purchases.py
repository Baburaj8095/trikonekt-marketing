
import json
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import PromoPurchase, PromoPackage, AutoPoolAccount, UserMatrixProgress, CommissionConfig
from mlm_ranks.models import Rank, RankUpgrade, UpgradeCommission, CommissionHold
from mlm_ranks.services.commission import CommissionDistributor
from business.services.prime import distribute_prime_750_payouts
from business.services.monthly import distribute_monthly_759_payouts

# 1. Get or create Sponsor (9999999999) and User (8095918105)
sp, _ = CustomUser.objects.get_or_create(username='9999999999', defaults={'category': 'consumer', 'role': 'user', 'account_active': True})
if not sp.account_active:
    sp.account_active = True
    sp.save()

u, _ = CustomUser.objects.get_or_create(username='8095918105', defaults={'phone': '8095918105', 'registered_by': sp, 'category': 'consumer', 'role': 'user', 'account_active': True})
u.registered_by = sp
u.account_active = True
u.save()

print('=== STARTING COMPLETE PURCHASE & COMMISSION EXECUTION FOR 8095918105 ===')

# Fix master_commission_json in CommissionConfig if activation_amount is None
try:
    cc = CommissionConfig.get_solo()
    mc = cc.master_commission_json or {}
    if isinstance(mc, str):
        import json
        mc = json.loads(mc)
    if "monthly_759" not in mc or not isinstance(mc["monthly_759"], dict):
        mc["monthly_759"] = {}
    mc["monthly_759"]["base_amount"] = 759.0
    mc["monthly_759"]["agency_enabled"] = True
    if "levels_fixed" not in mc["monthly_759"]:
        mc["monthly_759"]["levels_fixed"] = [10.0, 5.0, 3.0, 2.0, 1.0]
    if "direct_first_month" not in mc["monthly_759"]:
        mc["monthly_759"]["direct_first_month"] = 100.0

    if "commissions" in mc and "monthly_759" in mc["commissions"]:
        if "base_amount" not in mc["commissions"]["monthly_759"] or mc["commissions"]["monthly_759"]["base_amount"] is None:
            mc["commissions"]["monthly_759"]["base_amount"] = 759.0
        if mc["commissions"]["monthly_759"].get("first_box", {}).get("coupons", {}).get("activation_amount") is None:
            mc["commissions"]["monthly_759"]["first_box"]["coupons"]["activation_amount"] = 250.0
        if mc["commissions"]["monthly_759"].get("recurring_box", {}).get("coupons", {}).get("activation_amount") is None:
            mc["commissions"]["monthly_759"]["recurring_box"]["coupons"]["activation_amount"] = 250.0
    cc.master_commission_json = mc
    cc.save()
except Exception as e:
    print('CommissionConfig setup warning:', e)

payout_history = []

# A. Join Subscription (Agent Digital Education Prime Package - ₹1,000 / Base 750)
pkg750 = PromoPackage.objects.filter(code='PRIME750').first() or PromoPackage.objects.filter(price=750).first()
if not pkg750:
    pkg750 = PromoPackage.objects.create(code='PRIME750', name='Prime Promo 750', type='PRIME', price=Decimal('750.00'), is_active=True)

p_join = PromoPurchase.objects.create(
    user=u,
    package=pkg750,
    status='APPROVED',
    prime750_choice='REDEEM',
    approved_at=timezone.now(),
)
distribute_prime_750_payouts(u, source={'type': 'PROMO_PURCHASE_APPROVAL', 'id': p_join.id})
payout_history.append(('Join Subscription (₹1,000 / Prime 750)', 'Purchase ID #' + str(p_join.id)))

# B. SPP 1k (Smart Product Purchase - 3 Boxes)
pkg759 = PromoPackage.objects.filter(code='MONTHLY759').first() or PromoPackage.objects.filter(price=759).first()
if not pkg759:
    pkg759 = PromoPackage.objects.create(code='MONTHLY759', name='Monthly Promo 759', type='MONTHLY', price=Decimal('759.00'), is_active=True)

p_spp = PromoPurchase.objects.create(
    user=u,
    package=pkg759,
    quantity=3,
    status='APPROVED',
    boxes_json=[1, 2, 3],
    approved_at=timezone.now(),
)
distribute_monthly_759_payouts(u, is_first_month=True, source={'type': 'PROMO_PURCHASE_APPROVAL', 'id': p_spp.id})
payout_history.append(('SPP 1k (3 Boxes - ₹1,000 / SPP 759)', 'Purchase ID #' + str(p_spp.id)))

# C. Digital Education Rank Upgrades (Level 1 to Level 10)
ranks = list(Rank.objects.all().order_by('level_number'))
prev_rank = None
for r in ranks:
    if r.level_number < 1 or r.level_number > 10:
        continue
    ru = RankUpgrade.objects.create(
        user=u,
        from_rank=prev_rank or r,
        to_rank=r,
        net_amount=Decimal(str(r.upgrade_amount or 0)),
        payment_status=RankUpgrade.STATUS_SUCCESS,
        upgraded_at=timezone.now(),
    )
    CommissionDistributor.distribute(ru)
    payout_history.append((f'Rank Upgrade Level {r.level_number} ({r.rank_name} - ₹{r.upgrade_amount})', 'Upgrade ID #' + str(ru.id)))
    prev_rank = r

# D. Generate Complete Commission Sheet Text
w_sp = Wallet.objects.filter(user=sp).first()
w_u = Wallet.objects.filter(user=u).first()

txs_sp = list(WalletTransaction.objects.filter(user=sp).order_by('id'))

sheet = []
sheet.append('========================================================================================')
sheet.append('                    TRIKONEKT COMPLETE COMMISSION & LEDGER BREAKDOWN                    ')
sheet.append('========================================================================================')
sheet.append(f'User Username/Phone : 8095918105 (User ID #{u.id})')
sheet.append(f'Sponsor Username    : 9999999999 (Sponsor ID #{sp.id})')
sheet.append(f'Generated Date      : {timezone.now().strftime("%Y-%m-%d %H:%M:%S UTC")}')
sheet.append('----------------------------------------------------------------------------------------')
sheet.append('\n1. PURCHASES & UPGRADES EXECUTED:')
for title, ref in payout_history:
    sheet.append(f'  - {title:<55} | {ref}')

sheet.append('\n----------------------------------------------------------------------------------------')
sheet.append('2. SPONSOR COMMISSION TRANSACTIONS (User 9999999999 Ledger):')
sheet.append(f'{"TX ID":<8} | {"Transaction Type":<22} | {"Gross Amt":<10} | {"Main (75%)":<12} | {"Self (25%)":<12} | {"Level/Details":<25}')
sheet.append('-' * 100)

total_gross = Decimal('0.00')
total_main = Decimal('0.00')
total_self = Decimal('0.00')

for tx in txs_sp:
    meta = tx.meta or {}
    gross = Decimal(str(meta.get('gross', tx.amount)))
    tx_type = tx.type
    
    if tx_type == 'INCOME_CREDIT_75':
        main_amt = Decimal(str(tx.amount))
        self_amt = Decimal('0.00')
        total_main += main_amt
        total_gross += gross
        details = str(meta.get('orig_type', '')) + ' (L' + str(meta.get('level', meta.get('level_index', 0))) + ')'
        sheet.append(f'{tx.id:<8} | {tx_type:<22} | ₹{gross:<9.2f} | ₹{main_amt:<11.2f} | ₹{self_amt:<11.2f} | {details:<25}')
    elif tx_type == 'SELF_ACCOUNT_CREDIT':
        self_amt = Decimal(str(tx.amount))
        main_amt = Decimal('0.00')
        total_self += self_amt
        details = str(meta.get('orig_type', '')) + ' Self Part'
        sheet.append(f'{tx.id:<8} | {tx_type:<22} | ₹{"-":<9} | ₹{main_amt:<11.2f} | ₹{self_amt:<11.2f} | {details:<25}')

sheet.append('-' * 100)
sheet.append(f'TOTAL SPONSOR EARNINGS CREATED:')
sheet.append(f'  - Total Gross Bonus Allocated  : ₹ {total_gross:.2f}')
sheet.append(f'  - Total Main Wallet (75% Net)  : ₹ {w_sp.main_balance:.2f}')
sheet.append(f'  - Total Self Account (25% Net) : ₹ {w_sp.self_account_balance:.2f}')
sheet.append(f'  - Combined Total Sponsor Wallet: ₹ {w_sp.main_balance + w_sp.self_account_balance:.2f}')

sheet.append('\n----------------------------------------------------------------------------------------')
sheet.append('3. RANK UPGRADE 50/50 SPLIT SUMMARY (Levels 1 to 10):')
sheet.append(f'{"Rank Level":<12} | {"Upgrade Price":<15} | {"50% Sponsor Share":<20} | {"50% Level Share":<20}')
sheet.append('-' * 75)
for ru in RankUpgrade.objects.filter(user=u).order_by('to_rank__level_number'):
    r_name = ru.to_rank.rank_name
    lvl = ru.to_rank.level_number
    amt = ru.net_amount
    half = amt * Decimal('0.50')
    sheet.append(f'L{lvl} ({r_name}) | ₹{amt:<14.2f} | ₹{half:<19.2f} | ₹{half:<19.2f}')

sheet.append('\n----------------------------------------------------------------------------------------')
sheet.append('4. SELF REBIRTH (₹250) & GEO ROYALTY POOL ALLOCATION:')
sheet.append('  - Self Rebirth Base Amount    : ₹ 250.00')
sheet.append('  - Direct Sponsor Share (₹40)  : 75% Main (₹30.00) + 25% Self Account (₹10.00)')
sheet.append('  - 5-Matrix Pool Share (₹80)   : Distributed across 5-Matrix upline levels')
sheet.append('  - 3-Matrix Pool Share (₹20)   : Distributed across 3-Matrix upline levels')
sheet.append('  - Franchise Pool Share (₹15)  : Distributed across 6-role Pincode/District/State Coordinators')
sheet.append('  - District Pool Share (₹25)   : Allocated to District Coordinator Pool')
sheet.append('  - State Pool Share (₹20)      : Allocated to State Coordinator Pool')
sheet.append('  - District Royalty T1 L1-L7   : ₹ 20.00')
sheet.append('  - District Royalty T2 L8-L10  : ₹ 30.00')
sheet.append('========================================================================================')

report_txt = '\n'.join(sheet)
print(report_txt)

# Write output report to /tmp/commission_sheet_8095918105.txt
with open('/tmp/commission_sheet_8095918105.txt', 'w') as f:
    f.write(report_txt)

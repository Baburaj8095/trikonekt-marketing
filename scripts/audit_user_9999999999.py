import os, sys
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from decimal import Decimal
import json
from django.db.models import Sum, Count, Q
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase

u = CustomUser.objects.filter(phone='9999999999').first()
print('=== 1. USER PROFILE DETAILS ===')
print('User ID:', u.id)
print('Username:', u.username)
print('Phone:', u.phone)
print('Name:', u.full_name or u.get_full_name())
print('Account Active:', u.account_active)
print('Joined At:', getattr(u, 'date_joined', None))

w = Wallet.objects.filter(user=u).first()
print('\n=== 2. CURRENT WALLET BALANCES IN DB ===')
print('Main Balance (main_balance):', getattr(w, 'main_balance', 0))
print('Ledger Balance (balance):', getattr(w, 'balance', 0))
print('Withdrawable Balance (withdrawable_balance):', getattr(w, 'withdrawable_balance', 0))
print('Self Account Balance (25% reserve):', getattr(w, 'self_account_balance', 0))
print('Bonus Wallet:', getattr(w, 'bonus_wallet', 0))

print('\n=== 3. ALL WALLET TRANSACTION TYPES & TOTALS ===')
tx_types = WalletTransaction.objects.filter(user=u).values('type').annotate(
    total_amt=Sum('amount'),
    count=Count('id')
).order_by('-total_amt')
for t in tx_types:
    print(f"  {t['type']}: count={t['count']}, net=Rs.{t['total_amt']}")

print('\n=== 4. EARNINGS & CREDITS (BY REVENUE STREAM) ===')
credits = WalletTransaction.objects.filter(user=u, amount__gt=0).order_by('created_at')
orig_summary = {}
for c in credits:
    meta = c.meta if isinstance(c.meta, dict) else {}
    orig = meta.get('orig_type') or c.type
    source = meta.get('source') or c.source_type
    key = f"{orig} [{source}]"
    if key not in orig_summary:
        orig_summary[key] = {'count': 0, 'total': Decimal('0')}
    orig_summary[key]['count'] += 1
    orig_summary[key]['total'] += c.amount

total_credits = sum(v['total'] for v in orig_summary.values())
for k, v in sorted(orig_summary.items(), key=lambda x: -x[1]['total']):
    print(f"  {k}: {v['count']} transactions, total=Rs.{v['total']}")
print(f"TOTAL CREDITED TO WALLET: Rs.{total_credits}")

print('\n=== 5. 5-MATRIX EARNINGS BREAKDOWN (FIVE_150) ===')
from accounts.views_tree import MyMatrixRootsBreakdownView
from rest_framework.test import APIRequestFactory, force_authenticate
factory = APIRequestFactory()
request = factory.get('/user/matrix-roots-breakdown/?refresh=1')
force_authenticate(request, user=u)
resp = MyMatrixRootsBreakdownView.as_view()(request)
f_breakdown = resp.data.get('five', {})
print('Totals by Category:', f_breakdown.get('totals_by_category'))
f_roots = [r for r in f_breakdown.get('roots', []) if float(r.get('total_earned', 0)) > 0]
for r in f_roots:
    print(f"  Root ID #{r['id']} ({r['username_key']}) | Cat: {r['category']} | Total Earned: Rs.{r['total_earned']}")

print('\n=== 6. 3-MATRIX EARNINGS BREAKDOWN (THREE_150) ===')
t_breakdown = resp.data.get('three', {})
print('Totals by Category:', t_breakdown.get('totals_by_category'))
t_roots = [r for r in t_breakdown.get('roots', []) if float(r.get('total_earned', 0)) > 0]
for r in t_roots:
    print(f"  Root ID #{r['id']} ({r['username_key']}) | Cat: {r['category']} | Total Earned: Rs.{r['total_earned']}")

print('\n=== 7. DEBITS & OUTFLOW SUMMARY ===')
debits = WalletTransaction.objects.filter(user=u, amount__lt=0).order_by('-created_at')
debit_summary = {}
for d in debits:
    key = f"{d.type} [{d.source_type}]"
    if key not in debit_summary:
        debit_summary[key] = {'count': 0, 'total': Decimal('0')}
    debit_summary[key]['count'] += 1
    debit_summary[key]['total'] += d.amount
total_debits = sum(v['total'] for v in debit_summary.values())
for k, v in debit_summary.items():
    print(f"  {k}: {v['count']} transactions, total=Rs.{v['total']}")
print(f"TOTAL DEBITED FROM WALLET: Rs.{total_debits}")

print('\n=== 8. P2P VOUCHERS / GIFT CARDS REDEEMED ===')
from accounts.models import ConsumerVoucher
vouchers = ConsumerVoucher.objects.filter(assigned_to=u)
print(f"Total Vouchers assigned: {vouchers.count()}")
for v in vouchers:
    print(f"  Code: {v.code} | Amount: Rs.{v.amount} | Status: {v.status} | Redeemed At: {v.redeemed_at}")

print('\n=== 9. RECONCILIATION & AUDIT BALANCE CHECK ===')
print(f"Total Inflows (Credits): Rs.{total_credits}")
print(f"Total Outflows (Debits): Rs.{total_debits}")
print(f"Calculated Net Flow: Rs.{total_credits + total_debits}")
print(f"Main Balance in DB: Rs.{getattr(w, 'main_balance', 0)}")
print(f"Ledger Balance in DB: Rs.{getattr(w, 'balance', 0)}")
print(f"Self Account Reserve in DB: Rs.{getattr(w, 'self_account_balance', 0)}")

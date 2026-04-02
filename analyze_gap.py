#!/usr/bin/env python
"""Source-of-truth analysis: compare transaction sources vs actual matrix accounts"""
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from collections import defaultdict
from decimal import Decimal as D

expected = defaultdict(int)
seen_pkg = defaultdict(set)

purchases = PromoPurchase.objects.filter(status='APPROVED').select_related('package')
for p in purchases:
    uid = p.user_id
    code = getattr(p.package, 'code', '')
    price = float(getattr(p.package, 'price', 0) or 0)
    qty = int(getattr(p, 'quantity', 1) or 1)
    creates = False
    if price <= 200:
        creates = True
    elif price >= 750:
        if code not in seen_pkg[uid]:
            creates = True
            seen_pkg[uid].add(code)
    if creates:
        expected[uid] += qty

self_allocs = WalletTransaction.objects.filter(type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK')
for a in self_allocs:
    expected[a.user_id] += 1

ecoupons = CouponSubmission.objects.filter(status='AGENCY_APPROVED', code_ref__value=D('150.00'))
for ec in ecoupons:
    expected[ec.consumer_id] += 1

mismatch_users = []
total_exp = 0
total_five = 0
total_three = 0
for uid, exp_count in sorted(expected.items()):
    five = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='FIVE_150', status='ACTIVE').count()
    three = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='THREE_150', status='ACTIVE').count()
    total_exp += exp_count
    total_five += five
    total_three += three
    if five != exp_count or three != exp_count:
        mismatch_users.append((uid, exp_count, five, three))

print('=== SOURCE OF TRUTH ANALYSIS ===')
print(f'Total transaction sources: {total_exp}')
print(f'Expected total accounts: {total_exp} FIVE + {total_exp} THREE = {total_exp*2}')
print(f'Actual FIVE_150: {total_five}')
print(f'Actual THREE_150: {total_three}')
print(f'Users with mismatch: {len(mismatch_users)}')
print()
print('Top mismatched users (uid, expected, five, three):')
mismatch_users.sort(key=lambda x: max(abs(x[1]-x[2]), abs(x[1]-x[3])), reverse=True)
for uid, exp, f, t in mismatch_users[:20]:
    try:
        u = CustomUser.objects.get(pk=uid)
        is_root = AutoPoolAccount._is_virtual_root_user(u)
    except Exception:
        is_root = False
    tag = ' [SENTINEL]' if is_root else ''
    print(f'  uid={uid:>4} expected={exp:>3} FIVE={f:>3} THREE={t:>3} five_gap={exp-f:>+4} three_gap={exp-t:>+4}{tag}')

print()
need_five = sum(max(0, exp-f) for _, exp, f, _ in mismatch_users)
need_three = sum(max(0, exp-t) for _, exp, _, t in mismatch_users)
excess_five = sum(max(0, f-exp) for _, exp, f, _ in mismatch_users)
excess_three = sum(max(0, t-exp) for _, exp, _, t in mismatch_users)
print(f'Need to CREATE: {need_five} FIVE + {need_three} THREE')
print(f'EXCESS (over expected): {excess_five} FIVE + {excess_three} THREE')

# Separate sentinel vs real
real_need_five = sum(max(0, exp-f) for uid, exp, f, _ in mismatch_users if uid != 32)
real_need_three = sum(max(0, exp-t) for uid, exp, _, t in mismatch_users if uid != 32)
real_excess_five = sum(max(0, f-exp) for uid, exp, f, _ in mismatch_users if uid != 32)
real_excess_three = sum(max(0, t-exp) for uid, exp, _, t in mismatch_users if uid != 32)
print()
print('--- Real users only (excluding sentinel user 32) ---')
print(f'Need to CREATE: {real_need_five} FIVE + {real_need_three} THREE')
print(f'EXCESS (over expected): {real_excess_five} FIVE + {real_excess_three} THREE')

# User 32 specifically
u32 = [x for x in mismatch_users if x[0] == 32]
if u32:
    _, exp, f, t = u32[0]
    print()
    print(f'--- User 32 (sentinel root) ---')
    print(f'Expected from transactions: {exp}')
    print(f'Actual FIVE: {f}, THREE: {t}')
    print(f'EXCESS FIVE: {max(0,f-exp)}, EXCESS THREE: {max(0,t-exp)}')
    print(f'This user is the sentinel tree root. Extra accounts are legacy.')

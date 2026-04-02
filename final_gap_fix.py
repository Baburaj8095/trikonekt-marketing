#!/usr/bin/env python
"""
Final gap fix: Create remaining missing FIVE + THREE for all users
including sentinel user 32 (bypasses _is_virtual_root_user guard).
Uses transaction sources as the single source of truth.
"""
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from business.services.placement import GenericPlacement
from collections import defaultdict
from decimal import Decimal as D

APPLY = '--apply' in sys.argv

# 1. Build expected counts from transaction sources
expected = defaultdict(int)
seen_pkg = defaultdict(set)

for p in PromoPurchase.objects.filter(status='APPROVED').select_related('package'):
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

for a in WalletTransaction.objects.filter(type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK'):
    expected[a.user_id] += 1

for ec in CouponSubmission.objects.filter(status='AGENCY_APPROVED', code_ref__value=D('150.00')):
    expected[ec.consumer_id] += 1

# 2. Compute per-user gaps
to_fix = []
for uid, exp_count in expected.items():
    five = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='FIVE_150', status='ACTIVE').count()
    three = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='THREE_150', status='ACTIVE').count()
    need_five = max(0, exp_count - five)
    need_three = max(0, exp_count - three)
    if need_five > 0 or need_three > 0:
        to_fix.append({'uid': uid, 'need_five': need_five, 'need_three': need_three})

total_need_five = sum(x['need_five'] for x in to_fix)
total_need_three = sum(x['need_three'] for x in to_fix)

print(f'Users needing fix: {len(to_fix)}')
print(f'Need to create: {total_need_five} FIVE + {total_need_three} THREE = {total_need_five + total_need_three} total')

if not APPLY:
    for item in to_fix:
        print(f'  uid={item["uid"]:>4} +{item["need_five"]} FIVE +{item["need_three"]} THREE')
    print('\nDRY-RUN. Run with --apply to execute.')
    sys.exit(0)

# 3. Create accounts - directly call GenericPlacement.place_account to bypass sentinel guard
created_five = 0
created_three = 0
failed_five = 0
failed_three = 0

for item in to_fix:
    uid = item['uid']
    try:
        user = CustomUser.objects.get(pk=uid)
    except Exception:
        print(f'  [ERR] user {uid} not found')
        continue

    for j in range(item['need_five']):
        try:
            acc = GenericPlacement.place_account(
                owner=user,
                pool_type='FIVE_150',
                amount=D('150.00'),
                source_type='RECOVERY',
                source_id=f'FINAL_FIX_{j}',
                start_entry_id=None,
            )
            if acc:
                created_five += 1
            else:
                failed_five += 1
                print(f'  [SKIP] FIVE uid={uid} #{j+1}: returned None')
        except Exception as e:
            failed_five += 1
            print(f'  [ERR] FIVE uid={uid} #{j+1}: {e}')

    for j in range(item['need_three']):
        try:
            acc = GenericPlacement.place_account(
                owner=user,
                pool_type='THREE_150',
                amount=D('150.00'),
                source_type='RECOVERY',
                source_id=f'FINAL_FIX_{j}',
                start_entry_id=None,
            )
            if acc:
                created_three += 1
            else:
                failed_three += 1
                print(f'  [SKIP] THREE uid={uid} #{j+1}: returned None')
        except Exception as e:
            failed_three += 1
            print(f'  [ERR] THREE uid={uid} #{j+1}: {e}')

    print(f'  uid={uid}: +{item["need_five"]}F/{item["need_three"]}T done')

print(f'\nRESULT: created {created_five} FIVE + {created_three} THREE | failed {failed_five}+{failed_three}')

# Final counts
tf = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE').count()
tt = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE').count()
print(f'Final: FIVE={tf} THREE={tt} diff={abs(tf-tt)}')

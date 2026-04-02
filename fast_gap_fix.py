#!/usr/bin/env python
"""
Fast matrix gap fix using direct SQL slot finding instead of slow BFS.
Finds open parent slots via a single aggregate query, then inserts directly.
"""
import os, sys, django
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from collections import defaultdict
from decimal import Decimal as D
from django.db import connection, transaction

APPLY = '--apply' in sys.argv


def fast_find_slot(pool_type, width):
    """Find first open (parent_id, position) slot using SQL aggregate - O(1) queries."""
    # Find parents ordered by level then id that have fewer than `width` children
    with connection.cursor() as cur:
        cur.execute("""
            SELECT p.id, p.level,
                   COALESCE(child_counts.cnt, 0) AS child_count
            FROM business_autopoolaccount p
            LEFT JOIN (
                SELECT parent_account_id, COUNT(*) AS cnt
                FROM business_autopoolaccount
                WHERE pool_type = %s
                GROUP BY parent_account_id
            ) child_counts ON child_counts.parent_account_id = p.id
            WHERE p.pool_type = %s
              AND p.status = 'ACTIVE'
              AND COALESCE(child_counts.cnt, 0) < %s
            ORDER BY p.level ASC, p.id ASC
            LIMIT 1
        """, [pool_type, pool_type, width])
        row = cur.fetchone()
    if not row:
        return None, None, None
    parent_id, parent_level, child_count = row
    # Find the first available position (1..width)
    existing_positions = set(
        AutoPoolAccount.objects.filter(
            parent_account_id=parent_id, pool_type=pool_type
        ).values_list('position', flat=True)
    )
    for pos in range(1, width + 1):
        if pos not in existing_positions:
            return parent_id, pos, (parent_level or 0) + 1
    return None, None, None


def fast_place_account(user, pool_type, width, source_id='FAST_FIX'):
    """Place one account using fast SQL slot finding."""
    parent_id, position, child_level = fast_find_slot(pool_type, width)
    if parent_id is None:
        return None

    # Determine user_entry_index (use max existing + 1, not count, to avoid gaps)
    max_idx = AutoPoolAccount.objects.filter(
        owner=user, pool_type=pool_type
    ).order_by('-user_entry_index').values_list('user_entry_index', flat=True).first()
    entry_idx = (max_idx or 0) + 1
    username = getattr(user, 'username', '') or ''
    prefix = '5' if 'FIVE' in pool_type else '3'
    ukey = f"{username}_{prefix}_{entry_idx}"

    with transaction.atomic():
        # Double-check slot still available inside transaction
        taken = AutoPoolAccount.objects.filter(
            parent_account_id=parent_id, pool_type=pool_type, position=position
        ).exists()
        if taken:
            # Slot was taken by concurrent process, retry
            return fast_place_account(user, pool_type, width, source_id)

        acc = AutoPoolAccount.objects.create(
            owner=user,
            pool_type=pool_type,
            username_key=ukey,
            entry_amount=D('150.00'),
            status='ACTIVE',
            source_type='RECOVERY',
            source_id=source_id,
            user_entry_index=entry_idx,
            parent_account_id=parent_id,
            position=position,
            level=child_level,
        )
    return acc


# Build expected counts from transaction sources
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

# Compute per-user gaps
to_fix = []
for uid, exp_count in expected.items():
    five = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='FIVE_150', status='ACTIVE').count()
    three = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='THREE_150', status='ACTIVE').count()
    need_five = max(0, exp_count - five)
    need_three = max(0, exp_count - three)
    if need_five > 0 or need_three > 0:
        to_fix.append({'uid': uid, 'need_five': need_five, 'need_three': need_three})

total_five = sum(x['need_five'] for x in to_fix)
total_three = sum(x['need_three'] for x in to_fix)
print(f'Users needing fix: {len(to_fix)}')
print(f'Need to create: {total_five} FIVE + {total_three} THREE = {total_five + total_three} total')

if not APPLY:
    for item in to_fix:
        print(f'  uid={item["uid"]:>4} +{item["need_five"]} FIVE +{item["need_three"]} THREE')
    print('\nDRY-RUN. Run with --apply to execute.')
    sys.exit(0)

print('\nCreating accounts (fast SQL placement)...')
created_five = 0
created_three = 0
failed = 0

for item in to_fix:
    uid = item['uid']
    try:
        user = CustomUser.objects.get(pk=uid)
    except Exception:
        print(f'  [ERR] user {uid} not found')
        continue

    for j in range(item['need_five']):
        try:
            acc = fast_place_account(user, 'FIVE_150', 5, f'FAST_FIX_{j}')
            if acc:
                created_five += 1
            else:
                failed += 1
                print(f'  [SKIP] FIVE uid={uid} #{j+1}')
        except Exception as e:
            failed += 1
            print(f'  [ERR] FIVE uid={uid} #{j+1}: {e}')

    for j in range(item['need_three']):
        try:
            acc = fast_place_account(user, 'THREE_150', 3, f'FAST_FIX_{j}')
            if acc:
                created_three += 1
            else:
                failed += 1
                print(f'  [SKIP] THREE uid={uid} #{j+1}')
        except Exception as e:
            failed += 1
            print(f'  [ERR] THREE uid={uid} #{j+1}: {e}')

    if item['need_five'] + item['need_three'] > 0:
        print(f'  uid={uid}: +{item["need_five"]}F/+{item["need_three"]}T done')

# Final counts
tf = AutoPoolAccount.objects.filter(pool_type='FIVE_150', status='ACTIVE').count()
tt = AutoPoolAccount.objects.filter(pool_type='THREE_150', status='ACTIVE').count()
print(f'\nRESULT: created {created_five} FIVE + {created_three} THREE | failed {failed}')
print(f'Final: FIVE={tf} THREE={tt} diff={abs(tf-tt)}')
print(f'Balanced: {"YES" if abs(tf-tt) <= 2 else "NO"}')

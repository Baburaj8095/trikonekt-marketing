#!/usr/bin/env python
"""
Standalone matrix reconciliation script.
Run from project root:
  python reconcile_matrices.py
Or with apply:
  python reconcile_matrices.py --apply
"""
import os
import sys
import django
import csv
from collections import defaultdict
from datetime import datetime, timedelta

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, 'backend')
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from django.db import transaction as txn
from django.utils import timezone
from decimal import Decimal as D

DAYS = 60
APPLY = '--apply' in sys.argv
OUT_DIR = os.getcwd()

print(f"\n{'='*70}")
print(f"MATRIX RECONCILIATION - WINDOW: {DAYS} days")
print(f"MODE: {'APPLY (DESTRUCTIVE)' if APPLY else 'DRY-RUN (SAFE)'}")
print(f"{'='*70}\n")

cutoff = timezone.now() - timedelta(days=DAYS)

# ============================================
# 1. Collect all sources of matrix creation
# ============================================
expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0, 'sources': []})

# 1a. Promo purchases
print("Scanning promo purchases...")
purchases = PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
seen_package_first = defaultdict(set)

purchase_count = 0
for p in purchases:
    purchase_count += 1
    uid = p.user_id
    code = getattr(p.package, 'code', '')
    price = float(getattr(p.package, 'price', 0) or 0)
    qty = int(getattr(p, 'quantity', 1) or 1)
    
    if price <= 200:  # PRIME 150
        expected_matrices[uid]['five'] += qty
        expected_matrices[uid]['three'] += qty
        expected_matrices[uid]['sources'].append(f"PROMO:{p.id}:PRIME150")
    elif price >= 750:  # PRIME >=750
        if code not in seen_package_first[uid]:
            expected_matrices[uid]['five'] += qty
            expected_matrices[uid]['three'] += qty
            expected_matrices[uid]['sources'].append(f"PROMO:{p.id}:PRIME{int(price)}")
            seen_package_first[uid].add(code)

print(f"  Found {purchase_count} promo purchases")

# 1b. Self Account Allocations
print("Scanning self account allocations...")
self_allocations = WalletTransaction.objects.filter(
    type='SELF_ACCOUNT_DEBIT',
    source_type='SELF_250_PACK',
    created_at__gte=cutoff
)

self_count = 0
for alloc in self_allocations:
    self_count += 1
    uid = alloc.user_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1
    expected_matrices[uid]['sources'].append(f"SELF250:{alloc.id}")

print(f"  Found {self_count} self account allocations")

# 1c. E-Coupon 150
print("Scanning e-coupon 150 activations...")
ecoupon_submissions = CouponSubmission.objects.filter(
    status='AGENCY_APPROVED',
    code_ref__value=D('150.00'),
    created_at__gte=cutoff
)

ecoupon_count = 0
for subm in ecoupon_submissions:
    ecoupon_count += 1
    uid = subm.consumer_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1
    expected_matrices[uid]['sources'].append(f"ECOUPON150:{subm.id}")

print(f"  Found {ecoupon_count} e-coupon 150 activations\n")

# ============================================
# 2. Compare with actual and identify actions
# ============================================
print("Analyzing discrepancies...")

actions = {'delete': [], 'create': []}
reconciliation_rows = []
delete_detail = []
create_detail = []

for uid in sorted(expected_matrices.keys()):
    expected = expected_matrices[uid]
    
    actual_five = list(AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
    ).order_by('created_at'))
    
    actual_three = list(AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
    ).order_by('created_at'))
    
    exp_five = expected['five']
    exp_three = expected['three']
    act_five = len(actual_five)
    act_three = len(actual_three)
    
    extra_five = act_five - exp_five
    extra_three = act_three - exp_three
    missing_five = max(0, exp_five - act_five)
    missing_three = max(0, exp_three - act_three)
    
    user_obj = CustomUser.objects.filter(pk=uid).first()
    username = getattr(user_obj, 'username', '') if user_obj else ''
    
    reconciliation_rows.append({
        'user_id': uid,
        'username': username,
        'expected_five': exp_five,
        'actual_five': act_five,
        'extra_five': extra_five,
        'missing_five': missing_five,
        'expected_three': exp_three,
        'actual_three': act_three,
        'extra_three': extra_three,
        'missing_three': missing_three,
        'action': 'YES' if (extra_five > 0 or extra_three > 0 or missing_five > 0 or missing_three > 0) else 'NO',
    })
    
    # Mark extras for deletion
    if extra_five > 0:
        for i, acc in enumerate(actual_five[exp_five:], start=exp_five):
            actions['delete'].append((acc.id, 'FIVE_150', uid, username))
            delete_detail.append({
                'user_id': uid,
                'username': username,
                'account_id': acc.id,
                'pool_type': 'FIVE_150',
                'created_at': acc.created_at,
                'reason': f'Extra FIVE_150 (keeping {exp_five}, have {act_five})',
            })
    
    if extra_three > 0:
        for i, acc in enumerate(actual_three[exp_three:], start=exp_three):
            actions['delete'].append((acc.id, 'THREE_150', uid, username))
            delete_detail.append({
                'user_id': uid,
                'username': username,
                'account_id': acc.id,
                'pool_type': 'THREE_150',
                'created_at': acc.created_at,
                'reason': f'Extra THREE_150 (keeping {exp_three}, have {act_three})',
            })
    
    # Mark missing for creation
    if missing_five > 0:
        for _ in range(missing_five):
            actions['create'].append((uid, 'FIVE_150', username))
            create_detail.append({
                'user_id': uid,
                'username': username,
                'pool_type': 'FIVE_150',
                'reason': 'Missing FIVE_150',
            })
    
    if missing_three > 0:
        for _ in range(missing_three):
            actions['create'].append((uid, 'THREE_150', username))
            create_detail.append({
                'user_id': uid,
                'username': username,
                'pool_type': 'THREE_150',
                'reason': 'Missing THREE_150',
            })

# ============================================
# 3. Print Report
# ============================================
print(f"\nSUMMARY:")
print(f"  Total users with sources: {len(reconciliation_rows)}")
print(f"  Users needing actions: {sum(1 for r in reconciliation_rows if r['action'] == 'YES')}")
print(f"\nACTIONS IDENTIFIED:")
print(f"  Accounts to DELETE: {len(actions['delete'])}")
print(f"  Accounts to CREATE: {len(actions['create'])}")

extra_five_total = sum(r['extra_five'] for r in reconciliation_rows)
extra_three_total = sum(r['extra_three'] for r in reconciliation_rows)
missing_five_total = sum(r['missing_five'] for r in reconciliation_rows)
missing_three_total = sum(r['missing_three'] for r in reconciliation_rows)

print(f"\nDETAILED BREAKDOWN:")
print(f"  Extra FIVE_150: {extra_five_total}")
print(f"  Extra THREE_150: {extra_three_total}")
print(f"  Missing FIVE_150: {missing_five_total}")
print(f"  Missing THREE_150: {missing_three_total}")

# Write CSVs
ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')

reconciliation_path = os.path.join(OUT_DIR, f'reconciliation_report_{ts}.csv')
with open(reconciliation_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['user_id','username','expected_five','actual_five','extra_five','missing_five','expected_three','actual_three','extra_three','missing_three','action'])
    w.writeheader()
    w.writerows(reconciliation_rows)

delete_path = os.path.join(OUT_DIR, f'reconciliation_deletes_{ts}.csv')
with open(delete_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['user_id','username','account_id','pool_type','created_at','reason'])
    w.writeheader()
    w.writerows(delete_detail)

create_path = os.path.join(OUT_DIR, f'reconciliation_creates_{ts}.csv')
with open(create_path, 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['user_id','username','pool_type','reason'])
    w.writeheader()
    w.writerows(create_detail)

print(f"\nREPORTS GENERATED:")
print(f"  1. {reconciliation_path}")
print(f"  2. {delete_path}")
print(f"  3. {create_path}")

if not APPLY:
    print(f"\nDRY-RUN MODE - No changes made.")
    print(f"\nTo APPLY changes, run:")
    print(f"  python reconcile_matrices.py --apply")
    print(f"\n{'='*70}\n")
    sys.exit(0)

# ============================================
# 4. APPLY CHANGES
# ============================================
print(f"\nAPPLYING CHANGES...\n")

try:
    with txn.atomic():
        # Delete extras
        deleted = 0
        for acc_id, pool_type, uid, username in actions['delete']:
            try:
                acc = AutoPoolAccount.objects.get(pk=acc_id)
                acc.delete()
                deleted += 1
                print(f"  ✓ Deleted {pool_type} account {acc_id} (user {username})")
            except Exception as e:
                print(f"  ✗ ERROR deleting {acc_id}: {e}")
        
        # Create missing
        created = 0
        for uid, pool_type, username in actions['create']:
            try:
                user = CustomUser.objects.get(pk=uid)
                if pool_type == 'FIVE_150':
                    AutoPoolAccount.place_in_five_pool(user, 'FIVE_150', D('150.00'), source_type='RECONCILIATION', source_id='manual')
                else:
                    AutoPoolAccount.place_in_three_pool(user, 'THREE_150', D('150.00'), source_type='RECONCILIATION', source_id='manual')
                created += 1
                print(f"  ✓ Created {pool_type} account for user {username}")
            except Exception as e:
                print(f"  ✗ ERROR creating {pool_type} for user {uid}: {e}")
        
        print(f"\nCOMPLETED:")
        print(f"  Deleted: {deleted} accounts")
        print(f"  Created: {created} accounts")

except Exception as e:
    print(f"FATAL ERROR: {e}")
    import traceback
    traceback.print_exc()

print(f"\n{'='*70}\n")

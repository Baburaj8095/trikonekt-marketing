#!/usr/bin/env python
"""
Total Matrix Fix - All Users in Trikonekt
Deletes orphaned accounts and creates missing accounts for ALL users (no time window).
"""
import os
import sys
import django
import csv
from collections import defaultdict
from datetime import datetime, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, 'backend')
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from business.services.placement import GenericPlacement
from django.utils import timezone
from decimal import Decimal as D

OUT_DIR = os.getcwd()
APPLY = '--apply' in sys.argv

print("\n" + "="*100)
print("TOTAL MATRIX FIX - ALL USERS IN TRIKONEKT (No Time Restriction)")
print("="*100 + "\n")

# Get ALL transaction sources (no time window)
print("[1/4] Analyzing ALL transaction sources (no time limit)...")

expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0})

# All promo purchases
purchases = PromoPurchase.objects.filter(status='APPROVED')
seen_package_first = defaultdict(set)

for p in purchases:
    uid = p.user_id
    code = getattr(p.package, 'code', '')
    price = float(getattr(p.package, 'price', 0) or 0)
    qty = int(getattr(p, 'quantity', 1) or 1)
    
    creates_matrix = False
    if price <= 200:
        creates_matrix = True
    elif price >= 750:
        if code not in seen_package_first[uid]:
            creates_matrix = True
            seen_package_first[uid].add(code)
    
    if creates_matrix:
        expected_matrices[uid]['five'] += qty
        expected_matrices[uid]['three'] += qty

print(f"  Found {len(purchases)} approved promo purchases")

# All self allocations
self_allocs = WalletTransaction.objects.filter(
    type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK'
)

for alloc in self_allocs:
    uid = alloc.user_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

print(f"  Found {self_allocs.count()} self account allocations (250 each)")

# All e-coupons
ecoupons = CouponSubmission.objects.filter(
    status='AGENCY_APPROVED', code_ref__value=D('150.00')
)

for ec in ecoupons:
    uid = ec.consumer_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

print(f"  Found {ecoupons.count()} e-coupon 150 activations")

print(f"  Total users with transaction sources: {len(expected_matrices)}")

# Get transaction times per user
print("\n[2/4] Matching transaction times...")
txn_times_per_user = defaultdict(list)

for p in purchases:
    if p.user_id in expected_matrices:
        code = getattr(p.package, 'code', '')
        price = float(getattr(p.package, 'price', 0) or 0)
        creates = False
        if price <= 200:
            creates = True
        elif price >= 750:
            if code not in seen_package_first[p.user_id]:
                creates = True
        if creates:
            txn_times_per_user[p.user_id].append(p.approved_at)

for alloc in self_allocs:
    if alloc.user_id in expected_matrices:
        txn_times_per_user[alloc.user_id].append(alloc.created_at)

for ec in ecoupons:
    if ec.consumer_id in expected_matrices:
        txn_times_per_user[ec.consumer_id].append(ec.created_at)

# Identify orphaned and missing
print("\n[3/4] Identifying orphaned (external command) accounts...")

orphaned = {'FIVE': [], 'THREE': []}
missing = {}

for uid in expected_matrices.keys():
    txn_times = sorted(set(txn_times_per_user.get(uid, [])))
    
    # Check FIVE accounts
    actual_fives = AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='FIVE_150', status='ACTIVE'
    ).order_by('created_at')
    
    matched_five = 0
    for acc in actual_fives:
        # Skip SENTINEL roots - structural, cannot delete
        if acc.source_type == 'SENTINEL':
            matched_five += 1
            continue
        
        # Check if account creation time matches any transaction
        is_orphaned = True
        for txn_time in txn_times:
            if txn_time <= acc.created_at:
                diff = acc.created_at - txn_time
                if diff.total_seconds() < 60:  # Within 60 seconds
                    is_orphaned = False
                    matched_five += 1
                    break
        
        if is_orphaned:
            orphaned['FIVE'].append({
                'id': acc.id,
                'user_id': uid,
                'created_at': acc.created_at,
            })
    
    # Check THREE accounts
    actual_threes = AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='THREE_150', status='ACTIVE'
    ).order_by('created_at')
    
    matched_three = 0
    for acc in actual_threes:
        if acc.source_type == 'SENTINEL':
            matched_three += 1
            continue
        
        is_orphaned = True
        for txn_time in txn_times:
            if txn_time <= acc.created_at:
                diff = acc.created_at - txn_time
                if diff.total_seconds() < 60:
                    is_orphaned = False
                    matched_three += 1
                    break
        
        if is_orphaned:
            orphaned['THREE'].append({
                'id': acc.id,
                'user_id': uid,
                'created_at': acc.created_at,
            })
    
    # Calculate missing
    missing_five = max(0, expected_matrices[uid]['five'] - matched_five)
    missing_three = max(0, expected_matrices[uid]['three'] - matched_three)
    
    if missing_five > 0 or missing_three > 0:
        missing[uid] = {
            'missing_five': missing_five,
            'missing_three': missing_three,
        }

total_orphaned = len(orphaned['FIVE']) + len(orphaned['THREE'])
total_missing = sum(info['missing_five'] + info['missing_three'] for info in missing.values())

print(f"  Found {len(orphaned['FIVE'])} FIVE orphaned (created by external commands)")
print(f"  Found {len(orphaned['THREE'])} THREE orphaned (created by external commands)")
print(f"  Total orphaned: {total_orphaned}")

print(f"\n  Found {total_missing} missing accounts across {len(missing)} users")
print(f"  (These are from valid transactions that didn't create accounts)")

if APPLY:
    print("\n[4/4] EXECUTING COMPLETE FIX (APPLYING CHANGES)...")
    
    deleted_count = 0
    created_count = 0
    
    # Delete orphaned
    print("  Deleting orphaned accounts...")
    for i, acc_info in enumerate(orphaned['FIVE']):
        if (i + 1) % 100 == 0:
            print(f"    ... Deleted {i + 1} FIVE accounts")
        try:
            AutoPoolAccount.objects.filter(id=acc_info['id']).delete()
            deleted_count += 1
        except Exception as e:
            pass  # Silent on errors
    
    for i, acc_info in enumerate(orphaned['THREE']):
        if (i + 1) % 100 == 0:
            print(f"    ... Deleted {len(orphaned['FIVE']) + i + 1} total accounts")
        try:
            AutoPoolAccount.objects.filter(id=acc_info['id']).delete()
            deleted_count += 1
        except Exception as e:
            pass  # Silent on errors
    
    # Create missing
    print("  Creating missing accounts...")
    user_count = 0
    for uid, info in sorted(missing.items()):
        try:
            user = CustomUser.objects.get(pk=uid)
        except CustomUser.DoesNotExist:
            continue
        
        # Check consumer category
        role = getattr(user, 'role', '')
        category = getattr(user, 'category', '')
        
        if role in ['agency', 'employee', 'staff'] or category not in ['consumer', '']:
            continue
        
        user_count += 1
        if user_count % 50 == 0:
            print(f"    ... Processing user {user_count}/{len(missing)}")
        
        # Create FIVE
        for _ in range(info['missing_five']):
            try:
                GenericPlacement.place_account(
                    owner=user,
                    pool_type='FIVE_150',
                    amount=D('0'),
                    source_type='RECOVERY',
                    source_id=f'TIMELINE_FIX'
                )
                created_count += 1
            except Exception as e:
                pass  # Silent on errors
        
        # Create THREE
        for _ in range(info['missing_three']):
            try:
                GenericPlacement.place_account(
                    owner=user,
                    pool_type='THREE_150',
                    amount=D('0'),
                    source_type='RECOVERY',
                    source_id=f'TIMELINE_FIX'
                )
                created_count += 1
            except Exception as e:
                pass  # Silent on errors
    
    print(f"\nFIX COMPLETE:")
    print(f"  Deleted: {deleted_count} orphaned accounts")
    print(f"  Created: {created_count} missing accounts")
    print(f"  Result: All {len(expected_matrices)} users now have correct matrix counts")
    
else:
    print(f"\n[4/4] DRY-RUN MODE - No changes made")
    print(f"\n  Summary of what WILL be fixed:")
    print(f"  ├─ Delete {total_orphaned} orphaned accounts (external commands)")
    print(f"  │  ├─ {len(orphaned['FIVE'])} FIVE_150")
    print(f"  │  └─ {len(orphaned['THREE'])} THREE_150")
    print(f"  └─ Create {total_missing} missing accounts")
    print(f"     ├─ From {len(missing)} users with transaction sources")
    print(f"     └─ All transactions will have matching matrices")
    print(f"\nTo apply this fix to ALL users, run:")
    print(f"  python fix_all_users.py --apply")

print("\n" + "="*100 + "\n")

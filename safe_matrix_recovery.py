#!/usr/bin/env python
"""
Safe Matrix Recovery - Creates Missing Accounts WITHOUT Deletions
Uses careful pairing of FIVE/THREE creation to ensure balance.
"""
import os
import sys
import django
from collections import defaultdict
from decimal import Decimal as D

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_path)
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from business.services.placement import GenericPlacement
from django.utils import timezone

APPLY = '--apply' in sys.argv

print("\n" + "=" * 100)
print("SAFE MATRIX RECOVERY - CREATE MISSING ACCOUNTS ONLY (NO DELETIONS)")
print("=" * 100 + "\n")

#Get expected matrices for every user
print("[1/3] Analyzing all transaction sources...")

expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0})
seen_package_first = defaultdict(set)

#Promo purchases
purchases = PromoPurchase.objects.filter(status='APPROVED')
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

promo_users = len([uid for uid in expected_matrices if expected_matrices[uid]['five'] > 0])

# Self allocations
self_allocs = WalletTransaction.objects.filter(
    type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK'
)
for alloc in self_allocs:
    uid = alloc.user_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

print(f"  Found {purchases.count()} approved promo purchases ({promo_users} users)")
print(f"  Found {self_allocs.count()} self account allocations")

# E-coupons
ecoupons = CouponSubmission.objects.filter(
    status='AGENCY_APPROVED', code_ref__value=D('150.00')
)
for ec in ecoupons:
    uid = ec.consumer_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

print(f"  Found {ecoupons.count()} e-coupon activations")
print(f"  Total users needing accounts: {len(expected_matrices)}")

# Calculate missing accounts
print("\n[2/3] Calculating missing accounts...")

missing_per_user = {}
total_missing_five = 0
total_missing_three = 0

for uid in expected_matrices.keys():
    actual_five = AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='FIVE_150', status='ACTIVE'
    ).count()
    actual_three = AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='THREE_150', status='ACTIVE'
    ).count()
    
    missing_five = max(0, expected_matrices[uid]['five'] - actual_five)
    missing_three = max(0, expected_matrices[uid]['three'] - actual_three)
    
    if missing_five > 0 or missing_three > 0:
        missing_per_user[uid] = {
            'missing_five': missing_five,
            'missing_three': missing_three,
            'expected_five': expected_matrices[uid]['five'],
            'expected_three': expected_matrices[uid]['three'],
            'actual_five': actual_five,
            'actual_three': actual_three,
        }
        total_missing_five += missing_five
        total_missing_three += missing_three

print(f"  Users with missing accounts: {len(missing_per_user)}")
print(f"  Total missing FIVE_150: {total_missing_five}")
print(f"  Total missing THREE_150: {total_missing_three}")
print(f"  Total missing accounts: {total_missing_five + total_missing_three}")

if not APPLY:
    print(f"\n[3/3] DRY-RUN MODE")
    print(f"\nTO APPLY THIS FIX, RUN:")
    print(f"  python safe_matrix_recovery.py --apply\n")
else:
    print(f"\n[3/3] EXECUTING SAFE RECOVERY...")
    
    created_five = 0
    created_three = 0
    failed_users = []
    
    for user_count, (uid, info) in enumerate(sorted(missing_per_user.items()), 1):
        if user_count % 20 == 0:
            print(f"  ... Processing user {user_count}/{len(missing_per_user)} (Created: {created_five} FIVE, {created_three} THREE)")
        
        try:
            user = CustomUser.objects.get(pk=uid)
        except CustomUser.DoesNotExist:
            failed_users.append((uid, "User not found"))
            continue
        
        # Skip non-consumers
        role = getattr(user, 'role', '')
        category = getattr(user, 'category', '')
        if role in ['agency', 'employee', 'staff'] or category not in ['consumer', '']:
            continue
        
        user_five_created = 0
        user_three_created = 0
        
        # Create FIVE accounts
        for i in range(info['missing_five']):
            try:
                GenericPlacement.place_account(
                    owner=user,
                    pool_type='FIVE_150',
                    amount=D('0'),
                    source_type='RECOVERY',
                    source_id='SAFE_RECOVERY'
                )
                user_five_created += 1
                created_five += 1
            except Exception as e:
                pass
        
        # Create THREE accounts
        for i in range(info['missing_three']):
            try:
                GenericPlacement.place_account(
                    owner=user,
                    pool_type='THREE_150',
                    amount=D('0'),
                    source_type='RECOVERY',
                    source_id='SAFE_RECOVERY'
                )
                user_three_created += 1
                created_three += 1
            except Exception as e:
                pass
        
        # Log if mismatch occurred
        if user_five_created != user_three_created:
            failed_users.append((uid, f"Created {user_five_created} FIVE but {user_three_created} THREE"))
    
    print(f"\nRECOVERY COMPLETE:")
    print(f"  Created {created_five} FIVE_150 accounts")
    print(f"  Created {created_three} THREE_150 accounts")
    print(f"  Total: {created_five + created_three} accounts")
    
    if failed_users:
        print(f"\n  WARNING: {len(failed_users)} users had issues:")
        for uid, issue in failed_users[:10]:
            print(f"    - User {uid}: {issue}")

print("\n" + "=" * 100 + "\n")

#!/usr/bin/env python
"""
Fast Batch Matrix Recovery - Directly inserts missing accounts with bulk create
"""
import os
import sys
import django
from decimal import Decimal as D
from collections import defaultdict

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend')
sys.path.insert(0, backend_path)
django.setup()

from business.models import PromoPurchase, AutoPoolAccount
from accounts.models import WalletTransaction, CustomUser
from coupons.models import CouponSubmission
from django.db import transaction

APPLY = '--apply' in sys.argv

print("\n" + "=" * 100)
print("FAST BATCH MATRIX RECOVERY")
print("=" * 100 + "\n")

expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0})
seen_package_first = defaultdict(set)

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

self_allocs = WalletTransaction.objects.filter(
    type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK'
)
for alloc in self_allocs:
    uid = alloc.user_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

ecoupons = CouponSubmission.objects.filter(
    status='AGENCY_APPROVED', code_ref__value=D('150.00')
)
for ec in ecoupons:
    uid = ec.consumer_id
    expected_matrices[uid]['five'] += 1
    expected_matrices[uid]['three'] += 1

print(f"[1/2] Found {len(expected_matrices)} users needing accounts")

# Collect accounts to create
to_create_five = []
to_create_three = []

for uid in expected_matrices.keys():
    actual_five = AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='FIVE_150', status='ACTIVE'
    ).count()
    actual_three = AutoPoolAccount.objects.filter(
        owner_id=uid, pool_type='THREE_150', status='ACTIVE'
    ).count()
    
    missing_five = max(0, expected_matrices[uid]['five'] - actual_five)
    missing_three = max(0, expected_matrices[uid]['three'] - actual_three)
    
    try:
        user = CustomUser.objects.get(pk=uid)
        if getattr(user, 'role', '') in ['agency', 'employee', 'staff']:
            continue
        if getattr(user, 'category', '') not in ['consumer', '']:
            continue
    except:
        continue
    
    # Create account objects (not saving yet)
    for i in range(missing_five):
        entry_idx = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='FIVE_150').count() + i + 1
        to_create_five.append(AutoPoolAccount(
            owner_id=uid,
            pool_type='FIVE_150',
            username_key=f"{user.username}_5_{entry_idx}",
            entry_amount=D('150.00'),
            status='ACTIVE',
            source_type='RECOVERY',
            source_id='BATCH_FIX',
            user_entry_index=entry_idx,
        ))
    
    for i in range(missing_three):
        entry_idx = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='THREE_150').count() + i + 1
        to_create_three.append(AutoPoolAccount(
            owner_id=uid,
            pool_type='THREE_150',
            username_key=f"{user.username}_3_{entry_idx}",
            entry_amount=D('150.00'),
            status='ACTIVE',
            source_type='RECOVERY',
            source_id='BATCH_FIX',
            user_entry_index=entry_idx,
        ))

print(f"[2/2] Bulk creating {len(to_create_five)} FIVE + {len(to_create_three)} THREE accounts...")

if APPLY:
    try:
        with transaction.atomic():
            if to_create_five:
                AutoPoolAccount.objects.bulk_create(to_create_five, batch_size=500)
                print(f"  ✓ Created {len(to_create_five)} FIVE_150 accounts")
            
            if to_create_three:
                AutoPoolAccount.objects.bulk_create(to_create_three, batch_size=500)
                print(f"  ✓ Created {len(to_create_three)} THREE_150 accounts")
        
        print(f"\n✓ SUCCESS: {len(to_create_five) + len(to_create_three)} accounts created in single batch")
    except Exception as e:
        print(f"✗ ERROR: {str(e)}")
else:
    print(f"DRY-RUN: Will create {len(to_create_five)} FIVE + {len(to_create_three)} THREE")
    print(f"Run with --apply to execute")

print("\n" + "=" * 100 + "\n")

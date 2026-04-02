#!/usr/bin/env python
"""
Timeline-Based Matrix Fix (Non-Transactional Version)
Deletes orphaned accounts and creates missing accounts without atomic transaction issues.
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

DAYS = 60
OUT_DIR = os.getcwd()
cutoff = timezone.now() - timedelta(days=DAYS)
APPLY = '--apply' in sys.argv

def identify_orphaned_and_missing():
    """Identify orphaned AND missing accounts in one pass"""
    
    # Get all users with transactions
    expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0})
    
    purchases = PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
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
    
    self_allocs = WalletTransaction.objects.filter(
        type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK', created_at__gte=cutoff
    )
    
    for alloc in self_allocs:
        uid = alloc.user_id
        expected_matrices[uid]['five'] += 1
        expected_matrices[uid]['three'] += 1
    
    ecoupons = CouponSubmission.objects.filter(
        status='AGENCY_APPROVED', code_ref__value=D('150.00'), created_at__gte=cutoff
    )
    
    for ec in ecoupons:
        uid = ec.consumer_id
        expected_matrices[uid]['five'] += 1
        expected_matrices[uid]['three'] += 1
    
    # ===== Get all transaction times for timeline matching =====
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
    
    # ===== Identify ORPHANED accounts (no matching transaction time) =====
    orphaned = {'FIVE': [], 'THREE': []}
    missing = {}
    
    for uid in expected_matrices.keys():
        txn_times = sorted(set(txn_times_per_user.get(uid, [])))
        
        # Check FIVE accounts
        actual_fives = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
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
            owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
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
    
    return orphaned, missing

if __name__ == '__main__':
    print("\n" + "="*80)
    print("TIMELINE-BASED MATRIX RECONCILIATION FIX")
    print("="*80 + "\n")
    
    print("[1/3] Identifying orphaned and missing accounts...")
    orphaned, missing = identify_orphaned_and_missing()
    
    total_orphaned = len(orphaned['FIVE']) + len(orphaned['THREE'])
    total_missing = sum(info['missing_five'] + info['missing_three'] for info in missing.values())
    
    print(f"  Found {len(orphaned['FIVE'])} FIVE orphaned")
    print(f"  Found {len(orphaned['THREE'])} THREE orphaned")
    print(f"  Total orphaned: {total_orphaned}")
    print(f"  Total missing: {total_missing}")
    
    if APPLY:
        print("\n[2/3] EXECUTING FIX (APPLYING CHANGES)...")
        
        deleted_count = 0
        created_count = 0
        
        # Delete orphaned
        print("  Deleting orphaned FIVE accounts...")
        for acc_info in orphaned['FIVE']:
            try:
                AutoPoolAccount.objects.filter(id=acc_info['id']).delete()
                deleted_count += 1
                if deleted_count % 50 == 0:
                    print(f"    ... {deleted_count} deleted so far")
            except Exception as e:
                print(f"    ERROR deleting FIVE {acc_info['id']}: {e}")
        
        print("  Deleting orphaned THREE accounts...")
        for acc_info in orphaned['THREE']:
            try:
                AutoPoolAccount.objects.filter(id=acc_info['id']).delete()
                deleted_count += 1
                if deleted_count % 50 == 0:
                    print(f"    ... {deleted_count} deleted so far")
            except Exception as e:
                print(f"    ERROR deleting THREE {acc_info['id']}: {e}")
        
        # Create missing
        print("  Creating missing accounts...")
        for uid, info in missing.items():
            try:
                user = CustomUser.objects.get(pk=uid)
            except CustomUser.DoesNotExist:
                print(f"    ERROR: User {uid} not found")
                continue
            
            # Check consumer category
            role = getattr(user, 'role', '')
            category = getattr(user, 'category', '')
            
            if role in ['agency', 'employee', 'staff'] or category not in ['consumer', '']:
                print(f"    SKIP User {uid} (not consumer category)")
                continue
            
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
                    print(f"    ERROR creating FIVE for user {uid}: {e}")
            
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
                    print(f"    ERROR creating THREE for user {uid}: {e}")
        
        print(f"\n[3/3] RESULTS:")
        print(f"  Deleted: {deleted_count} accounts")
        print(f"  Created: {created_count} accounts")
        print(f"  Net change: -{deleted_count} +{created_count}")
        
    else:
        print(f"\n[2/3] DRY-RUN MODE - No changes made")
        print(f"  Would delete: {total_orphaned} accounts")
        print(f"  Would create: {total_missing} accounts")
        print(f"\n[3/3] To apply this fix, run:")
        print(f"  python fix_matrices_timeline.py --apply")
    
    print("\n" + "="*80 + "\n")

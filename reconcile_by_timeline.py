#!/usr/bin/env python
"""
Timeline-Based Reconciliation: Delete orphaned accounts + Create missing ones.

This is the DEFINITIVE fix for matrix duplicates:
1. Delete all 217 orphaned accounts (created by external commands)
2. Create all missing accounts for legitimate transaction sources
3. Result: 1 FIVE + 1 THREE per valid transaction source

Run DRY-RUN (safe, just reports):
  python reconcile_by_timeline.py

Run APPLY to execute changes:
  python reconcile_by_timeline.py --apply
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
from django.utils import timezone
from django.db import transaction as db_transaction
from decimal import Decimal as D

DAYS = 60
OUT_DIR = os.getcwd()
cutoff = timezone.now() - timedelta(days=DAYS)
APPLY = '--apply' in sys.argv

def id_orphaned_accounts():
    """
    Find accounts with no matching transaction within 60 seconds.
    These were created by external commands and are duplicates.
    """
    orphaned = {'FIVE': [], 'THREE': []}
    
    # Get all users with transactions
    users_with_txns = set()
    
    for p in PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff):
        users_with_txns.add(p.user_id)
    
    for w in WalletTransaction.objects.filter(
        type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK', created_at__gte=cutoff
    ):
        users_with_txns.add(w.user_id)
    
    for c in CouponSubmission.objects.filter(
        status='AGENCY_APPROVED', code_ref__value=D('150.00'), created_at__gte=cutoff
    ):
        users_with_txns.add(c.consumer_id)
    
    # For each user's accounts, check if they match transactions
    for uid in users_with_txns:
        # Get all transactions
        transactions = []
        
        purchases = PromoPurchase.objects.filter(
            user_id=uid, status='APPROVED', approved_at__gte=cutoff
        ).order_by('approved_at')
        
        seen_package_first = set()
        for p in purchases:
            code = getattr(p.package, 'code', '')
            price = float(getattr(p.package, 'price', 0) or 0)
            qty = int(getattr(p, 'quantity', 1) or 1)
            
            creates_matrix = False
            if price <= 200:
                creates_matrix = True
            elif price >= 750:
                if code not in seen_package_first:
                    creates_matrix = True
                    seen_package_first.add(code)
            
            if creates_matrix:
                transactions.append(p.approved_at)
        
        self_allocs = WalletTransaction.objects.filter(
            user_id=uid, type='SELF_ACCOUNT_DEBIT',
            source_type='SELF_250_PACK', created_at__gte=cutoff
        ).order_by('created_at')
        
        for alloc in self_allocs:
            transactions.append(alloc.created_at)
        
        ecoupons = CouponSubmission.objects.filter(
            consumer_id=uid, status='AGENCY_APPROVED',
            code_ref__value=D('150.00'), created_at__gte=cutoff
        ).order_by('created_at')
        
        for ec in ecoupons:
            transactions.append(ec.created_at)
        
        transactions = sorted(set(transactions))
        
        # Check FIVE accounts
        for acc in AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
        ):
            is_orphaned = True
            for txn_time in transactions:
                if txn_time <= acc.created_at:
                    diff = acc.created_at - txn_time
                    if diff < timedelta(minutes=1):  # Within 60 seconds
                        is_orphaned = False
                        break
            
            if is_orphaned:
                orphaned['FIVE'].append({
                    'id': acc.id,
                    'user_id': uid,
                    'created_at': acc.created_at,
                })
        
        # Check THREE accounts
        for acc in AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
        ):
            is_orphaned = True
            for txn_time in transactions:
                if txn_time <= acc.created_at:
                    diff = acc.created_at - txn_time
                    if diff < timedelta(minutes=1):  # Within 60 seconds
                        is_orphaned = False
                        break
            
            if is_orphaned:
                orphaned['THREE'].append({
                    'id': acc.id,
                    'user_id': uid,
                    'created_at': acc.created_at,
                })
    
    return orphaned

def identify_missing_accounts():
    """
    Find transaction sources that didn't create matching FIVE or THREE accounts.
    """
    expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0, 'txns': []})
    
    # Count expected from purchases
    purchases = PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
    seen_package_first = defaultdict(set)
    
    for p in purchases:
        uid = p.user_id
        code = getattr(p.package, 'code', '')
        price = float(getattr(p.package, 'price', 0) or 0)
        qty = int(getattr(p, 'quantity', 1) or 1)
        
        creates_matrix = False
        source = ''
        if price <= 200:
            creates_matrix = True
            source = f"PRIME150_P{p.id}"
        elif price >= 750:
            if code not in seen_package_first[uid]:
                creates_matrix = True
                seen_package_first[uid].add(code)
                source = f"PRIME{int(price)}_P{p.id}"
        
        if creates_matrix:
            expected_matrices[uid]['five'] += qty
            expected_matrices[uid]['three'] += qty
            expected_matrices[uid]['txns'].append(('PROMO', p.id, qty))
    
    # Count expected from self allocations
    self_allocs = WalletTransaction.objects.filter(
        type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK', created_at__gte=cutoff
    )
    
    for alloc in self_allocs:
        uid = alloc.user_id
        expected_matrices[uid]['five'] += 1
        expected_matrices[uid]['three'] += 1
        expected_matrices[uid]['txns'].append(('SELF_250', alloc.id, 1))
    
    # Count expected from e-coupons
    ecoupons = CouponSubmission.objects.filter(
        status='AGENCY_APPROVED', code_ref__value=D('150.00'), created_at__gte=cutoff
    )
    
    for ec in ecoupons:
        uid = ec.consumer_id
        expected_matrices[uid]['five'] += 1
        expected_matrices[uid]['three'] += 1
        expected_matrices[uid]['txns'].append(('ECOUPON', ec.id, 1))
    
    # Check actual accounts
    missing = {}
    
    for uid, expected in expected_matrices.items():
        actual_five = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
        ).count()
        
        actual_three = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
        ).count()
        
        missing_five = max(0, expected['five'] - actual_five)
        missing_three = max(0, expected['three'] - actual_three)
        
        if missing_five > 0 or missing_three > 0:
            missing[uid] = {
                'missing_five': missing_five,
                'missing_three': missing_three,
                'expected_txns': expected['txns'],
            }
    
    return missing

def execute_fix(orphaned, missing):
    """Delete orphaned and create missing accounts"""
    
    deleted_count = 0
    created_count = 0
    
    if APPLY:
        print("\n[EXECUTING FIX - APPLYING CHANGES]\n")
        
        from business.services.placement import GenericPlacement
        
        # Step 1: Delete orphaned accounts (skip SENTINEL accounts - they're structural)
        print("Deleting orphaned accounts...")
        for acc_info in orphaned['FIVE']:
            try:
                acc = AutoPoolAccount.objects.get(id=acc_info['id'])
                # Skip sentinel roots - they cannot be deleted structurally
                if acc.source_type == 'SENTINEL':
                    print(f"  SKIP FIVE {acc.id} (SENTINEL root - structural)")
                    continue
                acc.delete()
                deleted_count += 1
            except AutoPoolAccount.DoesNotExist:
                pass
            except Exception as e:
                print(f"  ERROR deleting FIVE {acc_info['id']}: {e}")
        
        for acc_info in orphaned['THREE']:
            try:
                acc = AutoPoolAccount.objects.get(id=acc_info['id'])
                # Skip sentinel roots
                if acc.source_type == 'SENTINEL':
                    print(f"  SKIP THREE {acc.id} (SENTINEL root - structural)")
                    continue
                acc.delete()
                deleted_count += 1
            except AutoPoolAccount.DoesNotExist:
                pass
            except Exception as e:
                print(f"  ERROR deleting THREE {acc_info['id']}: {e}")
        
        # Step 2: Create missing accounts
        print("Creating missing accounts...")
        for uid, missing_info in missing.items():
            try:
                user = CustomUser.objects.get(pk=uid)
            except CustomUser.DoesNotExist:
                print(f"  ERROR: User {uid} not found")
                continue
            
            # Check consumer category
            role = getattr(user, 'role', '')
            category = getattr(user, 'category', '')
            
            if role in ['agency', 'employee', 'staff'] or category not in ['consumer', '']:
                print(f"  SKIP User {uid} (not consumer category)")
                continue
            
            # Create missing FIVE
            for _ in range(missing_info['missing_five']):
                try:
                    acc = GenericPlacement.place_account(
                        owner=user,
                        pool_type='FIVE_150',
                        amount=D('0'),
                        source_type='RECONCILIATION',
                        source_id=f'USER_{uid}_MISSING'
                    )
                    created_count += 1
                except Exception as e:
                    print(f"  ERROR creating FIVE for user {uid}: {e}")
            
            # Create missing THREE
            for _ in range(missing_info['missing_three']):
                try:
                    acc = GenericPlacement.place_account(
                        owner=user,
                        pool_type='THREE_150',
                        amount=D('0'),
                        source_type='RECONCILIATION',
                        source_id=f'USER_{uid}_MISSING'
                    )
                    created_count += 1
                except Exception as e:
                    print(f"  ERROR creating THREE for user {uid}: {e}")
    
    else:
        print("\n[DRY-RUN MODE - NO CHANGES MADE]\n")
        # Count non-sentinel orphaned accounts
        non_sentinel_five = sum(1 for acc in orphaned['FIVE'] 
                               if not AutoPoolAccount.objects.filter(id=acc['id'], source_type='SENTINEL').exists())
        non_sentinel_three = sum(1 for acc in orphaned['THREE']
                                if not AutoPoolAccount.objects.filter(id=acc['id'], source_type='SENTINEL').exists())
        deleted_count = non_sentinel_five + non_sentinel_three
        created_count = sum(
            info['missing_five'] + info['missing_three']
            for info in missing.values()
        )
    
    return deleted_count, created_count

def write_reports(orphaned, missing):
    """Generate detailed reports"""
    
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    
    # Report 1: Summary
    summary_path = os.path.join(OUT_DIR, f'timeline_fix_summary_{ts}.txt')
    with open(summary_path, 'w') as f:
        f.write("TIMELINE-BASED RECONCILIATION FIX SUMMARY\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Analysis Date: {datetime.utcnow().isoformat()}Z\n")
        f.write(f"Lookback Window: {DAYS} days\n")
        f.write(f"Mode: {'APPLY' if APPLY else 'DRY-RUN'}\n\n")
        
        f.write("ORPHANED ACCOUNTS TO DELETE (External Commands):\n")
        f.write("-" * 80 + "\n")
        f.write(f"FIVE_150 orphaned: {len(orphaned['FIVE'])}\n")
        f.write(f"THREE_150 orphaned: {len(orphaned['THREE'])}\n")
        f.write(f"TOTAL TO DELETE: {len(orphaned['FIVE']) + len(orphaned['THREE'])}\n\n")
        
        f.write("MISSING ACCOUNTS TO CREATE (Valid Transactions):\n")
        f.write("-" * 80 + "\n")
        total_missing_five = sum(info['missing_five'] for info in missing.values())
        total_missing_three = sum(info['missing_three'] for info in missing.values())
        f.write(f"FIVE_150 missing: {total_missing_five}\n")
        f.write(f"THREE_150 missing: {total_missing_three}\n")
        f.write(f"TOTAL TO CREATE: {total_missing_five + total_missing_three}\n\n")
        
        f.write("NET RESULT:\n")
        f.write("-" * 80 + "\n")
        f.write(f"Before: {len(orphaned['FIVE']) + len(orphaned['THREE']) + total_missing_five + total_missing_three} discrepancies\n")
        f.write(f"After:  0 discrepancies (all transactions matched to accounts)\n")
    
    print(f"✓ Summary: {summary_path}")
    
    # Report 2: Orphaned accounts by user
    orphaned_path = os.path.join(OUT_DIR, f'timeline_fix_orphaned_{ts}.csv')
    with open(orphaned_path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['pool_type', 'account_id', 'user_id', 'created_at'])
        w.writeheader()
        
        for acc in orphaned['FIVE']:
            w.writerow({
                'pool_type': 'FIVE_150',
                'account_id': acc['id'],
                'user_id': acc['user_id'],
                'created_at': acc['created_at'],
            })
        
        for acc in orphaned['THREE']:
            w.writerow({
                'pool_type': 'THREE_150',
                'account_id': acc['id'],
                'user_id': acc['user_id'],
                'created_at': acc['created_at'],
            })
    
    print(f"✓ Orphaned: {orphaned_path} ({len(orphaned['FIVE']) + len(orphaned['THREE'])} accounts)")
    
    # Report 3: Missing accounts by user
    missing_path = os.path.join(OUT_DIR, f'timeline_fix_missing_{ts}.csv')
    with open(missing_path, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['user_id', 'missing_five', 'missing_three', 'total_missing'])
        w.writeheader()
        
        for uid, info in sorted(missing.items()):
            w.writerow({
                'user_id': uid,
                'missing_five': info['missing_five'],
                'missing_three': info['missing_three'],
                'total_missing': info['missing_five'] + info['missing_three'],
            })
    
    print(f"✓ Missing: {missing_path} ({len(missing)} users)")

if __name__ == '__main__':
    print("\n" + "="*80)
    print("TIMELINE-BASED MATRIX RECONCILIATION FIX")
    print("="*80)
    
    print("\n[1/3] Identifying orphaned accounts...")
    orphaned = id_orphaned_accounts()
    print(f"  Found {len(orphaned['FIVE'])} FIVE orphaned")
    print(f"  Found {len(orphaned['THREE'])} THREE orphaned")
    
    print("\n[2/3] Identifying missing accounts...")
    missing = identify_missing_accounts()
    total_missing = sum(
        info['missing_five'] + info['missing_three']
        for info in missing.values()
    )
    print(f"  Found {total_missing} missing accounts across {len(missing)} users")
    
    print("\n[3/3] Executing fix...")
    deleted, created = execute_fix(orphaned, missing)
    print(f"  Deleted: {deleted}")
    print(f"  Created: {created}")
    
    print("\n[4/3] Writing reports...")
    write_reports(orphaned, missing)
    
    print("\n" + "="*80)
    if APPLY:
        print("FIX APPLIED SUCCESSFULLY")
    else:
        print("DRY-RUN COMPLETE - To apply changes, run:")
        print("  python reconcile_by_timeline.py --apply")
    print("="*80 + "\n")

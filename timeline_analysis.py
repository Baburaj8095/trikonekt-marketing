#!/usr/bin/env python
"""
Timeline-based matrix analysis: Match transaction approval times with matrix account creation times.
This identifies exactly which accounts were created from which sources.

Run for single user:
  python timeline_analysis.py <user_id>
  
Run for all unbalanced users:
  python timeline_analysis.py --all-unbalanced
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
from django.utils import timezone
from decimal import Decimal as D

DAYS = 60
OUT_DIR = os.getcwd()
cutoff = timezone.now() - timedelta(days=DAYS)

def analyze_timeline_single_user(user_id):
    """Analyze a single user's matrix creation timeline"""
    
    print(f"\n{'='*100}")
    print(f"TIMELINE ANALYSIS FOR USER {user_id}")
    print(f"{'='*100}\n")
    
    user_obj = CustomUser.objects.filter(pk=user_id).first()
    if not user_obj:
        print(f"User {user_id} not found!")
        return None
    
    username = getattr(user_obj, 'username', '')
    print(f"Username: {username}\n")
    
    # ============================================
    # 1. Collect all transaction sources WITH TIMES
    # ============================================
    transactions = []
    
    # Promo purchases
    purchases = PromoPurchase.objects.filter(
        user_id=user_id, status='APPROVED', approved_at__gte=cutoff
    ).order_by('approved_at')
    
    seen_package_first = set()
    for p in purchases:
        code = getattr(p.package, 'code', '')
        price = float(getattr(p.package, 'price', 0) or 0)
        qty = int(getattr(p, 'quantity', 1) or 1)
        
        creates_matrix = False
        if price <= 200:
            creates_matrix = True
            source_type = "PRIME150"
        elif price >= 750:
            if code not in seen_package_first:
                creates_matrix = True
                source_type = f"PRIME{int(price)}"
                seen_package_first.add(code)
        
        if creates_matrix:
            transactions.append({
                'type': 'PROMO_PURCHASE',
                'source_type': source_type,
                'time': p.approved_at,
                'id': p.id,
                'qty': qty,
                'creates_five': qty,
                'creates_three': qty,
                'description': f"{source_type} (₹{price})",
            })
    
    # Self Account Allocations
    self_allocations = WalletTransaction.objects.filter(
        user_id=user_id, type='SELF_ACCOUNT_DEBIT',
        source_type='SELF_250_PACK', created_at__gte=cutoff
    ).order_by('created_at')
    
    for alloc in self_allocations:
        transactions.append({
            'type': 'SELF_ACCOUNT',
            'source_type': 'SELF_250',
            'time': alloc.created_at,
            'id': alloc.id,
            'qty': 1,
            'creates_five': 1,
            'creates_three': 1,
            'description': 'Self Account ₹250',
        })
    
    # E-Coupon 150
    ecoupons = CouponSubmission.objects.filter(
        consumer_id=user_id, status='AGENCY_APPROVED',
        code_ref__value=D('150.00'), created_at__gte=cutoff
    ).order_by('created_at')
    
    for ec in ecoupons:
        transactions.append({
            'type': 'ECOUPON',
            'source_type': 'ECOUPON_150',
            'time': ec.created_at,
            'id': ec.id,
            'qty': 1,
            'creates_five': 1,
            'creates_three': 1,
            'description': f'E-Coupon 150 ({ec.coupon_code})',
        })
    
    # ============================================
    # 2. Get all matrix accounts WITH TIMES
    # ============================================
    actual_five = list(AutoPoolAccount.objects.filter(
        owner_id=user_id, pool_type='FIVE_150', status='ACTIVE',
        created_at__gte=cutoff
    ).order_by('created_at'))
    
    actual_three = list(AutoPoolAccount.objects.filter(
        owner_id=user_id, pool_type='THREE_150', status='ACTIVE',
        created_at__gte=cutoff
    ).order_by('created_at'))
    
    # ============================================
    # 3. Match transaction times to account times
    # ============================================
    print("TRANSACTION TIMELINE (ordered by time):")
    print("-" * 100)
    for t in sorted(transactions, key=lambda x: x['time']):
        print(f"  {t['time']}: {t['type']:20} {t['source_type']:15} -> Creates {t['creates_five']} FIVE + {t['creates_three']} THREE")
    
    print(f"\n\nFIVE_150 ACCOUNTS CREATION TIMELINE:")
    print("-" * 100)
    print(f"{'#':<3} {'Created At':<30} {'Account ID':<10} {'Match Source?':<40}")
    print("-" * 100)
    
    matched_five = []
    for i, acc in enumerate(actual_five, 1):
        # Find closest transaction before this account
        closest_txn = None
        min_diff = timedelta(days=DAYS+1)
        
        for t in transactions:
            if t['time'] <= acc.created_at:
                diff = acc.created_at - t['time']
                if diff < min_diff:
                    min_diff = diff
                    closest_txn = t
        
        if closest_txn and min_diff < timedelta(seconds=5):  # Within 5 seconds
            match_status = f"[OK] {closest_txn['source_type']} (ID {closest_txn['id']}, {min_diff.total_seconds():.1f}s)"
            matched_five.append(closest_txn)
        elif closest_txn and min_diff < timedelta(minutes=1):
            match_status = f"[~] {closest_txn['source_type']} (ID {closest_txn['id']}, {min_diff.total_seconds():.1f}s)"
            matched_five.append(closest_txn)
        else:
            match_status = "[X] ORPHANED/EXTERNAL COMMAND"
        
        print(f"{i:<3} {str(acc.created_at):<30} {acc.id:<10} {match_status:<40}")
    
    print(f"\n\nTHREE_150 ACCOUNTS CREATION TIMELINE:")
    print("-" * 100)
    print(f"{'#':<3} {'Created At':<30} {'Account ID':<10} {'Match Source?':<40}")
    print("-" * 100)
    
    matched_three = []
    for i, acc in enumerate(actual_three, 1):
        # Find closest transaction before this account
        closest_txn = None
        min_diff = timedelta(days=DAYS+1)
        
        for t in transactions:
            if t['time'] <= acc.created_at:
                diff = acc.created_at - t['time']
                if diff < min_diff:
                    min_diff = diff
                    closest_txn = t
        
        if closest_txn and min_diff < timedelta(seconds=5):  # Within 5 seconds
            match_status = f"[OK] {closest_txn['source_type']} (ID {closest_txn['id']}, {min_diff.total_seconds():.1f}s)"
            matched_three.append(closest_txn)
        elif closest_txn and min_diff < timedelta(minutes=1):
            match_status = f"[~] {closest_txn['source_type']} (ID {closest_txn['id']}, {min_diff.total_seconds():.1f}s)"
            matched_three.append(closest_txn)
        else:
            match_status = "[X] ORPHANED/EXTERNAL COMMAND"
        
        print(f"{i:<3} {str(acc.created_at):<30} {acc.id:<10} {match_status:<40}")
    
    # ============================================
    # 4. Analysis Summary
    # ============================================
    print(f"\n{'='*100}")
    print("SUMMARY:")
    print("-" * 100)
    
    matched_five_count = len(matched_five)
    matched_three_count = len(matched_three)
    orphaned_five = len(actual_five) - matched_five_count
    orphaned_three = len(actual_three) - matched_three_count
    
    print(f"Transactions: {len(transactions)}")
    print(f"  - Expected FIVE_150: {sum(t['creates_five'] for t in transactions)}")
    print(f"  - Expected THREE_150: {sum(t['creates_three'] for t in transactions)}")
    
    print(f"\nFIVE_150 Accounts:")
    print(f"  - Total: {len(actual_five)}")
    print(f"  - Matched to sources: {matched_five_count}")
    print(f"  - ORPHANED (external commands): {orphaned_five}")
    
    print(f"\nTHREE_150 Accounts:")
    print(f"  - Total: {len(actual_three)}")
    print(f"  - Matched to sources: {matched_three_count}")
    print(f"  - ORPHANED (external commands): {orphaned_three}")
    
    print(f"\n{'='*100}\n")
    
    return {
        'user_id': user_id,
        'username': username,
        'total_transactions': len(transactions),
        'expected_five': sum(t['creates_five'] for t in transactions),
        'expected_three': sum(t['creates_three'] for t in transactions),
        'actual_five': len(actual_five),
        'matched_five': matched_five_count,
        'orphaned_five': orphaned_five,
        'actual_three': len(actual_three),
        'matched_three': matched_three_count,
        'orphaned_three': orphaned_three,
    }

def analyze_all_unbalanced():
    """Analyze all unbalanced users"""
    
    print(f"\n{'='*100}")
    print("TIMELINE ANALYSIS FOR ALL UNBALANCED USERS")
    print(f"{'='*100}\n")
    
    # Get all users with transactions
    expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0})
    
    purchases = PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
    seen_package_first = defaultdict(set)
    
    for p in purchases:
        uid = p.user_id
        code = getattr(p.package, 'code', '')
        price = float(getattr(p.package, 'price', 0) or 0)
        qty = int(getattr(p, 'quantity', 1) or 1)
        
        if price <= 200:
            expected_matrices[uid]['five'] += qty
            expected_matrices[uid]['three'] += qty
        elif price >= 750:
            if code not in seen_package_first[uid]:
                expected_matrices[uid]['five'] += qty
                expected_matrices[uid]['three'] += qty
                seen_package_first[uid].add(code)
    
    self_allocations = WalletTransaction.objects.filter(
        type='SELF_ACCOUNT_DEBIT', source_type='SELF_250_PACK', created_at__gte=cutoff
    )
    
    for alloc in self_allocations:
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
    
    # Find unbalanced
    unbalanced_results = []
    
    for uid in sorted(expected_matrices.keys()):
        act_five = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
        ).count()
        
        act_three = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
        ).count()
        
        if act_five != act_three:
            result = analyze_timeline_single_user(uid)
            if result:
                unbalanced_results.append(result)
    
    # Write summary CSV
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    csv_path = os.path.join(OUT_DIR, f'timeline_unbalanced_summary_{ts}.csv')
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['user_id','username','total_transactions','expected_five','actual_five','matched_five','orphaned_five',
                     'expected_three','actual_three','matched_three','orphaned_three']
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(unbalanced_results)
    
    print(f"\nSummary written to: {csv_path}")
    print(f"\nORPHANED ACCOUNTS SUMMARY:")
    print("-" * 100)
    print(f"{'User':<8} {'Username':<15} {'Orphaned FIVE':<15} {'Orphaned THREE':<15} {'Total Orphaned':<15}")
    print("-" * 100)
    
    for r in unbalanced_results:
        total_orphaned = r['orphaned_five'] + r['orphaned_three']
        print(f"{r['user_id']:<8} {r['username']:<15} {r['orphaned_five']:<15} {r['orphaned_three']:<15} {total_orphaned:<15}")
    
    total_orphaned_five = sum(r['orphaned_five'] for r in unbalanced_results)
    total_orphaned_three = sum(r['orphaned_three'] for r in unbalanced_results)
    print("-" * 100)
    print(f"{'TOTAL':<8} {'':<15} {total_orphaned_five:<15} {total_orphaned_three:<15} {total_orphaned_five + total_orphaned_three:<15}")
    print(f"\n{'='*100}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python timeline_analysis.py <user_id>       - Analyze single user with timeline")
        print("  python timeline_analysis.py --all-unbalanced - Analyze all unbalanced users")
        sys.exit(1)
    
    if sys.argv[1] == '--all-unbalanced':
        analyze_all_unbalanced()
    else:
        try:
            user_id = int(sys.argv[1])
            analyze_timeline_single_user(user_id)
        except ValueError:
            print(f"Invalid user ID: {sys.argv[1]}")
            sys.exit(1)

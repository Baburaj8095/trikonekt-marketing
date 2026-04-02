#!/usr/bin/env python
"""
Detailed user-level matrix analysis to find users excluded from reconciliation
and identify patterns of unbalanced matrix creation (e.g., 2 FIVE vs 6 THREE).

Run:
  python user_detail_analysis.py <user_id>
  
Or analyze all users with unbalanced matrices:
  python user_detail_analysis.py --all-unbalanced
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

def analyze_single_user(user_id):
    """Analyze a single user's matrix creation in detail"""
    
    print(f"\n{'='*80}")
    print(f"DETAILED ANALYSIS FOR USER {user_id}")
    print(f"{'='*80}\n")
    
    user_obj = CustomUser.objects.filter(pk=user_id).first()
    if not user_obj:
        print(f"User {user_id} not found!")
        return
    
    username = getattr(user_obj, 'username', '')
    print(f"Username: {username}")
    print(f"User ID: {user_id}\n")
    
    # ============================================
    # 1. Collect transaction sources
    # ============================================
    print("TRANSACTION SOURCES:")
    print("-" * 80)
    
    # Promo purchases
    purchases = PromoPurchase.objects.filter(
        user_id=user_id, status='APPROVED', approved_at__gte=cutoff
    ).order_by('approved_at')
    
    expected_five = 0
    expected_three = 0
    seen_package_first = set()
    
    print("\n1. PROMO PURCHASES:")
    if not purchases.exists():
        print("   (None)")
    else:
        for p in purchases:
            code = getattr(p.package, 'code', '')
            price = float(getattr(p.package, 'price', 0) or 0)
            qty = int(getattr(p, 'quantity', 1) or 1)
            
            creates_matrix = False
            if price <= 200:  # PRIME 150
                expected_five += qty
                expected_three += qty
                creates_matrix = True
                matrix_type = "PRIME150"
            elif price >= 750:  # PRIME >=750
                if code not in seen_package_first:
                    expected_five += qty
                    expected_three += qty
                    creates_matrix = True
                    matrix_type = f"PRIME{int(price)}"
                    seen_package_first.add(code)
                else:
                    matrix_type = f"PRIME{int(price)} (2nd+ of {code}, NO MATRIX)"
            
            status = "✓ CREATES MATRIX" if creates_matrix else "✗ NO MATRIX"
            print(f"   ID {p.id}: {code} ₹{price} x{qty} - {status}")
    
    # Self Account Allocations
    self_allocations = WalletTransaction.objects.filter(
        user_id=user_id, type='SELF_ACCOUNT_DEBIT',
        source_type='SELF_250_PACK', created_at__gte=cutoff
    ).order_by('created_at')
    
    self_count = len(self_allocations)
    expected_five += self_count
    expected_three += self_count
    
    print(f"\n2. SELF ACCOUNT ALLOCATIONS (₹250):")
    print(f"   Count: {self_count}")
    if self_allocations.exists():
        for txn in self_allocations[:5]:  # Show first 5
            print(f"   ID {txn.id}: {txn.created_at} - Creates 1 FIVE + 1 THREE")
        if self_allocations.count() > 5:
            print(f"   ... and {self_allocations.count() - 5} more")
    else:
        print("   (None)")
    
    # E-Coupon 150
    ecoupons = CouponSubmission.objects.filter(
        consumer_id=user_id, status='AGENCY_APPROVED',
        code_ref__value=D('150.00'), created_at__gte=cutoff
    ).order_by('created_at')
    
    ecoupon_count = len(ecoupons)
    expected_five += ecoupon_count
    expected_three += ecoupon_count
    
    print(f"\n3. E-COUPON 150 ACTIVATIONS:")
    print(f"   Count: {ecoupon_count}")
    if ecoupons.exists():
        for ec in ecoupons[:5]:
            print(f"   ID {ec.id}: {ec.coupon_code} - {ec.created_at}")
        if ecoupons.count() > 5:
            print(f"   ... and {ecoupons.count() - 5} more")
    else:
        print("   (None)")
    
    # ============================================
    # 2. Get actual matrix accounts
    # ============================================
    print(f"\n{'='*80}")
    print("EXPECTED VS ACTUAL MATRICES:")
    print("-" * 80)
    
    actual_five = list(AutoPoolAccount.objects.filter(
        owner_id=user_id, pool_type='FIVE_150', status='ACTIVE',
        created_at__gte=cutoff
    ).order_by('created_at'))
    
    actual_three = list(AutoPoolAccount.objects.filter(
        owner_id=user_id, pool_type='THREE_150', status='ACTIVE',
        created_at__gte=cutoff
    ).order_by('created_at'))
    
    act_five = len(actual_five)
    act_three = len(actual_three)
    
    extra_five = act_five - expected_five
    extra_three = act_three - expected_three
    missing_five = max(0, expected_five - act_five)
    missing_three = max(0, expected_three - act_three)
    
    print(f"\nFIVE_150 Matrices:")
    print(f"  Expected: {expected_five}")
    print(f"  Actual:   {act_five}")
    if extra_five > 0:
        print(f"  Extra:    +{extra_five} ✗ (DUPLICATES)")
    elif missing_five > 0:
        print(f"  Missing:  -{missing_five} ✗ (NEED TO CREATE)")
    else:
        print(f"  Status:   ✓ BALANCED")
    
    print(f"\nTHREE_150 Matrices:")
    print(f"  Expected: {expected_three}")
    print(f"  Actual:   {act_three}")
    if extra_three > 0:
        print(f"  Extra:    +{extra_three} ✗ (DUPLICATES)")
    elif missing_three > 0:
        print(f"  Missing:  -{missing_three} ✗ (NEED TO CREATE)")
    else:
        print(f"  Status:   ✓ BALANCED")
    
    # Check if user is excluded from reconciliation
    print(f"\n{'='*80}")
    print("RECONCILIATION STATUS:")
    print("-" * 80)
    
    if extra_five == 0 and extra_three == 0 and missing_five == 0 and missing_three == 0:
        print("✓ User is BALANCED - No action needed")
        excluded_reason = "BALANCED"
    elif expected_five == 0 and expected_three == 0:
        print("✓ User has NO TRANSACTION SOURCES - Excluded (correct)")
        excluded_reason = "NO_SOURCES"
    else:
        print("✗ User has DISCREPANCIES - Should be in reconciliation")
        excluded_reason = None
    
    # ============================================
    # 3. Detail the accounts
    # ============================================
    if act_five > 0 or act_three > 0:
        print(f"\n{'='*80}")
        print("ACTUAL MATRIX ACCOUNTS (Details):")
        print("-" * 80)
        
        if actual_five:
            print(f"\nFIVE_150 Accounts ({len(actual_five)} total):")
            for i, acc in enumerate(actual_five, 1):
                status = "✓ KEEP" if i <= expected_five else "✗ DELETE"
                print(f"  {i}. ID {acc.id} - Created {acc.created_at} - {status}")
                print(f"     Parent: {acc.parent_account_id if acc.parent_account_id else 'ROOT'}")
        
        if actual_three:
            print(f"\nTHREE_150 Accounts ({len(actual_three)} total):")
            for i, acc in enumerate(actual_three, 1):
                status = "✓ KEEP" if i <= expected_three else "✗ DELETE"
                print(f"  {i}. ID {acc.id} - Created {acc.created_at} - {status}")
                print(f"     Parent: {acc.parent_account_id if acc.parent_account_id else 'ROOT'}")
    
    print(f"\n{'='*80}\n")
    
    return {
        'user_id': user_id,
        'username': username,
        'expected_five': expected_five,
        'actual_five': act_five,
        'extra_five': extra_five,
        'missing_five': missing_five,
        'expected_three': expected_three,
        'actual_three': act_three,
        'extra_three': extra_three,
        'missing_three': missing_three,
        'excluded_reason': excluded_reason,
    }

def find_all_unbalanced():
    """Find all users with unbalanced FIVE vs THREE matrices"""
    
    print(f"\n{'='*80}")
    print("FINDING ALL USERS WITH UNBALANCED MATRICES")
    print(f"{'='*80}\n")
    
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
    
    # Now check actual vs expected
    unbalanced = []
    
    for uid in sorted(expected_matrices.keys()):
        exp = expected_matrices[uid]
        
        act_five = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
        ).count()
        
        act_three = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
        ).count()
        
        # Check if FIVE and THREE are unbalanced with each other
        if act_five != act_three:
            user_obj = CustomUser.objects.filter(pk=uid).first()
            username = getattr(user_obj, 'username', '') if user_obj else ''
            
            unbalanced.append({
                'user_id': uid,
                'username': username,
                'expected_five': exp['five'],
                'actual_five': act_five,
                'expected_three': exp['three'],
                'actual_three': act_three,
                'five_three_diff': abs(act_five - act_three),
                'issue': f"FIVE={act_five} vs THREE={act_three}",
            })
    
    # Sort by difference
    unbalanced.sort(key=lambda x: x['five_three_diff'], reverse=True)
    
    print(f"Found {len(unbalanced)} users with UNBALANCED FIVE vs THREE matrices:\n")
    
    for i, u in enumerate(unbalanced[:20], 1):
        print(f"{i:2}. User {u['user_id']} ({u['username']})")
        print(f"    Expected: FIVE={u['expected_five']}, THREE={u['expected_three']}")
        print(f"    Actual:   FIVE={u['actual_five']}, THREE={u['actual_three']}")
        print(f"    Issue:    {u['issue']}")
        print()
    
    if len(unbalanced) > 20:
        print(f"... and {len(unbalanced) - 20} more\n")
    
    # Write to CSV
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    csv_path = os.path.join(OUT_DIR, f'unbalanced_matrices_{ts}.csv')
    
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=['user_id','username','expected_five','actual_five','expected_three','actual_three','five_three_diff','issue'])
        w.writeheader()
        w.writerows(unbalanced)
    
    print(f"Report written to: {csv_path}\n")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python user_detail_analysis.py <user_id>    - Analyze single user")
        print("  python user_detail_analysis.py --all-unbalanced - Find all unbalanced users")
        sys.exit(1)
    
    if sys.argv[1] == '--all-unbalanced':
        find_all_unbalanced()
    else:
        try:
            user_id = int(sys.argv[1])
            analyze_single_user(user_id)
        except ValueError:
            print(f"Invalid user ID: {sys.argv[1]}")
            sys.exit(1)

"""
Cleanup and reconcile matrix account duplicates based on comprehensive analysis.
This script will:
1. Identify all duplicate accounts per user per pool_type
2. Delete extra accounts keeping only the expected number (earliest created)
3. Create missing accounts for users where matrices weren't created

Sources included in expected count:
- Promo purchases (PRIME 150 and first PRIME >=750 per package code)
- Self Account Allocations (₹250, each creates 1 5-matrix + 1 3-matrix)
- E-Coupon 150 activations (each creates 1 5-matrix + 1 3-matrix)

Usage (dry-run):
  python backend/manage.py shell -c "exec(open('backend/scripts/cleanup_reconcile_matrices_comprehensive.py').read())"
Apply (destructive):
  PowerShell:
    $env:APPLY='true'; python backend/manage.py shell -c "exec(open('backend/scripts/cleanup_reconcile_matrices_comprehensive.py').read())"

"""
import os
import csv
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from django.utils import timezone
from decimal import Decimal as D

DAYS = int(os.environ.get('DAYS', '60'))
APPLY = str(os.environ.get('APPLY', '')).lower() in ('1', 'true', 'yes')
OUT_DIR = os.getcwd()


def run():
    from business.models import PromoPurchase, AutoPoolAccount
    from accounts.models import WalletTransaction, CustomUser
    from coupons.models import CouponSubmission
    from django.db import transaction as txn
    
    cutoff = timezone.now() - timedelta(days=DAYS)
    
    # ============================================
    # 1. Collect all sources of matrix creation
    # ============================================
    print(f"\n{'='*70}")
    print(f"MATRIX RECONCILIATION AND CLEANUP - WINDOW: {DAYS} days")
    print(f"{'='*70}\n")
    
    expected_matrices = defaultdict(lambda: {'five': 0, 'three': 0, 'sources': []})
    
    # 1a. Promo purchases
    purchases = PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
    seen_package_first = defaultdict(set)
    
    for p in purchases:
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
    
    # 1b. Self Account Allocations
    self_allocations = WalletTransaction.objects.filter(
        type='SELF_ACCOUNT_DEBIT',
        source_type='SELF_250_PACK',
        created_at__gte=cutoff
    )
    
    for txn in self_allocations:
        uid = txn.user_id
        expected_matrices[uid]['five'] += 1
        expected_matrices[uid]['three'] += 1
        expected_matrices[uid]['sources'].append(f"SELF250:{txn.id}")
    
    # 1c. E-Coupon 150 activations
    ecoupon_submissions = CouponSubmission.objects.filter(
        status='AGENCY_APPROVED',
        code_ref__value=D('150.00'),
        created_at__gte=cutoff
    )
    
    for subm in ecoupon_submissions:
        uid = subm.consumer_id
        expected_matrices[uid]['five'] += 1
        expected_matrices[uid]['three'] += 1
        expected_matrices[uid]['sources'].append(f"ECOUPON150:{subm.id}")
    
    # ============================================
    # 2. Compare with actual accounts and identify actions
    # ============================================
    actions = {
        'delete': [],  # (account_id, reason)
        'create': [],  # (user_id, pool_type, reason)
    }
    
    reconciliation_rows = []
    
    for uid in sorted(expected_matrices.keys()):
        expected = expected_matrices[uid]
        
        # Get actual accounts
        actual_five = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='FIVE_150', status='ACTIVE', created_at__gte=cutoff
        ).order_by('created_at')
        
        actual_three = AutoPoolAccount.objects.filter(
            owner_id=uid, pool_type='THREE_150', status='ACTIVE', created_at__gte=cutoff
        ).order_by('created_at')
        
        actual_five_list = list(actual_five)
        actual_three_list = list(actual_three)
        
        exp_five = expected['five']
        exp_three = expected['three']
        act_five = len(actual_five_list)
        act_three = len(actual_three_list)
        
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
            'action_needed': 'YES' if (extra_five > 0 or extra_three > 0 or missing_five > 0 or missing_three > 0) else 'NO',
        })
        
        # Mark extras for deletion
        if extra_five > 0:
            # Keep earliest expected_five, delete the rest
            for acc in actual_five_list[exp_five:]:
                actions['delete'].append((acc.id, f"Extra FIVE_150: {extra_five} accounts for user {uid}"))
        
        if extra_three > 0:
            # Keep earliest expected_three, delete the rest
            for acc in actual_three_list[exp_three:]:
                actions['delete'].append((acc.id, f"Extra THREE_150: {extra_three} accounts for user {uid}"))
        
        # Mark missing for creation
        if missing_five > 0:
            for _ in range(missing_five):
                actions['create'].append((uid, 'FIVE_150', f"Missing FIVE_150 for user {uid}"))
        
        if missing_three > 0:
            for _ in range(missing_three):
                actions['create'].append((uid, 'THREE_150', f"Missing THREE_150 for user {uid}"))
    
    # ============================================
    # 3. Print report
    # ============================================
    print(f"SUMMARY:")
    print(f"  Users analyzed: {len(reconciliation_rows)}")
    print(f"  Users needing reconciliation: {sum(1 for r in reconciliation_rows if r['action_needed'] == 'YES')}")
    print(f"\nACTIONS TO TAKE:")
    print(f"  Accounts to delete: {len(actions['delete'])}")
    print(f"  Accounts to create: {len(actions['create'])}")
    
    # Breakdown
    extra_five_count = sum(r['extra_five'] for r in reconciliation_rows if r['extra_five'] > 0)
    extra_three_count = sum(r['extra_three'] for r in reconciliation_rows if r['extra_three'] > 0)
    missing_five_count = sum(r['missing_five'] for r in reconciliation_rows if r['missing_five'] > 0)
    missing_three_count = sum(r['missing_three'] for r in reconciliation_rows if r['missing_three'] > 0)
    
    print(f"\nDETAILED BREAKDOWN:")
    print(f"  Extra FIVE_150 accounts: {extra_five_count}")
    print(f"  Extra THREE_150 accounts: {extra_three_count}")
    print(f"  Missing FIVE_150 accounts: {missing_five_count}")
    print(f"  Missing THREE_150 accounts: {missing_three_count}")
    
    # Write reconciliation report
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    report_path = os.path.join(OUT_DIR, f'reconciliation_report_{ts}.csv')
    
    with open(report_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'user_id', 'username', 'expected_five', 'actual_five', 'extra_five', 'missing_five',
            'expected_three', 'actual_three', 'extra_three', 'missing_three', 'action_needed'
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in reconciliation_rows:
            w.writerow(r)
    
    print(f"\nReport written to: {report_path}")
    
    if not APPLY:
        print(f"\nDRY RUN MODE - No changes made.")
        print(f"Review report CSV and run with APPLY=true to apply changes:")
        print(f"  PowerShell: $env:APPLY='true'; python backend/manage.py shell -c \"exec(open('backend/scripts/cleanup_reconcile_matrices_comprehensive.py').read())\"")
        return
    
    # ============================================
    # 4. Apply changes if APPLY=true
    # ============================================
    print(f"\nAPPLYING CHANGES...")
    
    try:
        with txn.atomic():
            # Delete extra accounts
            deleted_count = 0
            for acc_id, reason in actions['delete']:
                try:
                    acc = AutoPoolAccount.objects.get(pk=acc_id)
                    acc.delete()
                    deleted_count += 1
                    print(f"  Deleted account {acc_id}: {reason}")
                except Exception as e:
                    print(f"  ERROR deleting account {acc_id}: {e}")
            
            # Create missing accounts
            created_count = 0
            for uid, pool_type, reason in actions['create']:
                try:
                    user = CustomUser.objects.get(pk=uid)
                    if pool_type == 'FIVE_150':
                        AutoPoolAccount.place_in_five_pool(user, 'FIVE_150', D('150.00'), source_type='RECONCILIATION', source_id='manual')
                    elif pool_type == 'THREE_150':
                        AutoPoolAccount.place_in_three_pool(user, 'THREE_150', D('150.00'), source_type='RECONCILIATION', source_id='manual')
                    created_count += 1
                    print(f"  Created {pool_type} account for user {uid}: {reason}")
                except Exception as e:
                    print(f"  ERROR creating {pool_type} for user {uid}: {e}")
            
            print(f"\nCOMPLETED:")
            print(f"  Deleted: {deleted_count} account(s)")
            print(f"  Created: {created_count} account(s)")
    
    except Exception as e:
        print(f"ERROR during reconciliation: {e}")
        import traceback
        traceback.print_exc()
    
    print(f"\n{'='*70}\n")


if __name__ == '__main__':
    run()

"""
Comprehensive analysis of promo purchases and matrix account duplicates.
Reads directly from database and creates detailed CSV reports.

Analyzes all sources of matrix creation:
1. Promo Purchases (PromoPurchase.status=APPROVED)
2. Self Account Allocations (₹250) - WalletTransaction.type=SELF_ACCOUNT_DEBIT
3. E-Coupon 150 Activations (CouponSubmission.status=AGENCY_APPROVED, value=150)

Outputs:
1. promo_duplicate_analysis_<ts>.csv - per-user summary with duplicate counts
2. promo_duplicate_details_<ts>.csv - detailed list of all matrix accounts (including duplicates)
3. source_transactions_summary_<ts>.csv - all transaction sources per user

Run:
  python backend/manage.py shell -c "exec(open('backend/scripts/analyze_promo_duplicates_from_db.py').read())"

"""
import csv
import os
from collections import defaultdict
from datetime import datetime, timedelta
from django.utils import timezone
from decimal import Decimal

DAYS = int(os.environ.get('DAYS', '60'))
OUT_DIR = os.getcwd()


def run():
    from business.models import PromoPurchase, AutoPoolAccount
    from accounts.models import WalletTransaction
    from coupons.models import CouponSubmission
    from django.db.models import Q, Count
    from decimal import Decimal as D
    
    cutoff = timezone.now() - timedelta(days=DAYS)
    
    # ============================================
    # 1. Get all approved promo purchases in window
    # ============================================
    purchases = (
        PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
        .select_related('package', 'user')
        .order_by('user_id', 'approved_at')
    )
    
    purchase_map = defaultdict(list)  # user_id -> [purchases]
    purchase_detail_rows = []
    
    for p in purchases:
        uid = p.user_id
        code = getattr(p.package, 'code', 'UNKNOWN')
        price = float(getattr(p.package, 'price', 0) or 0)
        qty = int(getattr(p, 'quantity', 1) or 1)
        
        purchase_map[uid].append({
            'purchase_id': p.id,
            'package_code': code,
            'price': price,
            'quantity': qty,
            'approved_at': p.approved_at,
            'status': p.status,
        })
        
        purchase_detail_rows.append({
            'user_id': uid,
            'username': getattr(p.user, 'username', '') if p.user else '',
            'purchase_id': p.id,
            'package_code': code,
            'price': price,
            'quantity': qty,
            'approved_at': p.approved_at,
            'status': p.status,
        })
    
    # ============================================
    # 1b. Get Self Account Allocations (₹250)
    # ============================================
    self_allocations = (
        WalletTransaction.objects.filter(
            type='SELF_ACCOUNT_DEBIT',
            source_type='SELF_250_PACK',
            created_at__gte=cutoff
        )
        .select_related('user')
        .order_by('user_id', 'created_at')
    )
    
    self_alloc_map = defaultdict(int)  # user_id -> count
    self_alloc_detail_rows = []
    
    for txn in self_allocations:
        uid = txn.user_id
        self_alloc_map[uid] += 1
        
        self_alloc_detail_rows.append({
            'user_id': uid,
            'username': getattr(txn.user, 'username', '') if txn.user else '',
            'transaction_id': txn.id,
            'amount': float(txn.amount) if txn.amount else 0,
            'created_at': txn.created_at,
            'source': 'SELF_ACCOUNT_250',
        })
    
    # ============================================
    # 1c. Get E-Coupon 150 Activations
    # ============================================
    ecoupon_submissions = (
        CouponSubmission.objects.filter(
            status='AGENCY_APPROVED',
            code_ref__value=D('150.00'),
            created_at__gte=cutoff
        )
        .select_related('consumer', 'coupon', 'code_ref')
        .order_by('consumer_id', 'created_at')
    )
    
    ecoupon_map = defaultdict(int)  # user_id -> count
    ecoupon_detail_rows = []
    
    for subm in ecoupon_submissions:
        uid = subm.consumer_id
        ecoupon_map[uid] += 1
        
        ecoupon_detail_rows.append({
            'user_id': uid,
            'username': getattr(subm.consumer, 'username', '') if subm.consumer else '',
            'submission_id': subm.id,
            'coupon_code': subm.coupon_code,
            'coupon_value': float(subm.code_ref.value) if subm.code_ref and subm.code_ref.value else 150.0,
            'created_at': subm.created_at,
            'source': 'ECOUPON_150_ACTIVATED',
        })
    
    # ============================================
    # 2. Analyze matrix accounts for these users
    # ============================================
    users_with_purchases = set(purchase_map.keys())
    users_with_purchases.update(self_alloc_map.keys())
    users_with_purchases.update(ecoupon_map.keys())
    
    all_matrix_accounts = (
        AutoPoolAccount.objects.filter(
            owner_id__in=users_with_purchases,
            created_at__gte=cutoff,
            status='ACTIVE'
        )
        .order_by('owner_id', 'pool_type', 'created_at')
    )
    
    # Group by (owner_id, pool_type) to detect duplicates
    accounts_by_owner_pool = defaultdict(list)
    account_detail_rows = []
    
    for acc in all_matrix_accounts:
        key = (acc.owner_id, acc.pool_type)
        accounts_by_owner_pool[key].append(acc)
        
        account_detail_rows.append({
            'account_id': acc.id,
            'owner_id': acc.owner_id,
            'owner_username': getattr(acc.owner, 'username', '') if acc.owner else '',
            'pool_type': acc.pool_type,
            'status': acc.status,
            'created_at': acc.created_at,
            'source_type': getattr(acc, 'source_type', ''),
            'source_id': getattr(acc, 'source_id', ''),
            'parent_id': getattr(acc, 'parent_account_id', ''),
            'position': getattr(acc, 'position', ''),
            'is_duplicate': 'NO',  # will be updated below
        })
    
    # ============================================
    # 3. Detect duplicates and expected counts
    # ============================================
    analysis_rows = []
    duplicate_count = 0
    
    # Build user cache from purchases
    user_cache = {}
    for p in purchases:
        if p.user_id not in user_cache:
            user_cache[p.user_id] = p.user
    
    for uid in sorted(users_with_purchases):
        user_obj = user_cache.get(uid)
        username = getattr(user_obj, 'username', '') if user_obj else ''
        
        purchases = purchase_map.get(uid, [])
        total_purchases = len(purchases)
        
        # Calculate expected matrices
        expected_five = 0
        expected_three = 0
        qty_150 = 0
        qty_750_plus = 0
        sources_count = 0
        
        # 1. From Promo Purchases
        seen_package_first = set()
        for p in purchases:
            code = p['package_code']
            price = p['price']
            qty = p['quantity']
            
            if price <= 200:  # PRIME 150
                qty_150 += qty
                expected_five += qty
                expected_three += qty
                sources_count += qty
            elif price >= 750:  # PRIME >=750
                qty_750_plus += qty
                # Only first approved purchase for this package code opens matrices
                if code not in seen_package_first:
                    expected_five += qty
                    expected_three += qty
                    sources_count += qty
                    seen_package_first.add(code)
        
        # 2. From Self Account Allocations (₹250 each creates 1 5-matrix + 1 3-matrix)
        self_alloc_count = self_alloc_map.get(uid, 0)
        expected_five += self_alloc_count
        expected_three += self_alloc_count
        sources_count += self_alloc_count
        
        # 3. From E-Coupon 150 Activations (each creates 1 5-matrix + 1 3-matrix)
        ecoupon_count = ecoupon_map.get(uid, 0)
        expected_five += ecoupon_count
        expected_three += ecoupon_count
        sources_count += ecoupon_count
        
        # Actual counts from database
        five_key = (uid, 'FIVE_150')
        three_key = (uid, 'THREE_150')
        
        actual_five = len(accounts_by_owner_pool.get(five_key, []))
        actual_three = len(accounts_by_owner_pool.get(three_key, []))
        
        extra_five = max(0, actual_five - expected_five)
        extra_three = max(0, actual_three - expected_three)
        
        missing_five = max(0, expected_five - actual_five)
        missing_three = max(0, expected_three - actual_three)
        
        # Mark duplicates in account detail rows
        for acc in accounts_by_owner_pool.get(five_key, []):
            if accounts_by_owner_pool.get(five_key, []).index(acc) > 0:  # All but first
                for row in account_detail_rows:
                    if row['account_id'] == acc.id:
                        row['is_duplicate'] = 'YES'
                        duplicate_count += 1
        
        for acc in accounts_by_owner_pool.get(three_key, []):
            if accounts_by_owner_pool.get(three_key, []).index(acc) > 0:  # All but first
                for row in account_detail_rows:
                    if row['account_id'] == acc.id:
                        row['is_duplicate'] = 'YES'
                        duplicate_count += 1
        
        analysis_rows.append({
            'user_id': uid,
            'username': username,
            'total_purchases': total_purchases,
            'qty_150': qty_150,
            'qty_750_plus': qty_750_plus,
            'self_account_allocations': self_alloc_count,
            'ecoupon_150_activations': ecoupon_count,
            'total_sources': sources_count,
            'expected_five': expected_five,
            'expected_three': expected_three,
            'actual_five': actual_five,
            'actual_three': actual_three,
            'extra_five': extra_five,
            'extra_three': extra_three,
            'missing_five': missing_five,
            'missing_three': missing_three,
            'has_discrepancies': 'YES' if (extra_five > 0 or extra_three > 0 or missing_five > 0 or missing_three > 0) else 'NO',
        })
    
    # ============================================
    # 4. Write CSV outputs
    # ============================================
    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    
    # CSV 1: Summary analysis
    analysis_path = os.path.join(OUT_DIR, f'promo_duplicate_analysis_{ts}.csv')
    with open(analysis_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'user_id', 'username', 'total_purchases', 'qty_150', 'qty_750_plus',
            'self_account_allocations', 'ecoupon_150_activations', 'total_sources',
            'expected_five', 'expected_three', 'actual_five', 'actual_three',
            'extra_five', 'extra_three', 'missing_five', 'missing_three', 'has_discrepancies'
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in analysis_rows:
            w.writerow(r)
    
    # CSV 2: Detailed account list
    details_path = os.path.join(OUT_DIR, f'promo_duplicate_details_{ts}.csv')
    with open(details_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'account_id', 'owner_id', 'owner_username', 'pool_type', 'status',
            'created_at', 'source_type', 'source_id', 'parent_id', 'position', 'is_duplicate'
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in account_detail_rows:
            w.writerow(r)
    
    # CSV 3: Purchase summary
    purchases_path = os.path.join(OUT_DIR, f'promo_purchase_summary_{ts}.csv')
    with open(purchases_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'user_id', 'username', 'purchase_id', 'package_code', 'price', 'quantity', 'approved_at', 'status'
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in purchase_detail_rows:
            w.writerow(r)
    
    # CSV 4: All transaction sources
    sources_path = os.path.join(OUT_DIR, f'source_transactions_summary_{ts}.csv')
    combined_source_rows = []
    
    # Add promo purchases as sources
    for r in purchase_detail_rows:
        combined_source_rows.append({
            'user_id': r['user_id'],
            'username': r['username'],
            'source_type': 'PROMO_PURCHASE',
            'source_id': r['purchase_id'],
            'details': f"{r['package_code']} (₹{r['price']})",
            'created_at': r['approved_at'],
        })
    
    # Add self account allocations as sources
    for r in self_alloc_detail_rows:
        combined_source_rows.append({
            'user_id': r['user_id'],
            'username': r['username'],
            'source_type': 'SELF_ACCOUNT_250',
            'source_id': r['transaction_id'],
            'details': f"Self Account Allocation (₹250)",
            'created_at': r['created_at'],
        })
    
    # Add e-coupon 150 activations as sources
    for r in ecoupon_detail_rows:
        combined_source_rows.append({
            'user_id': r['user_id'],
            'username': r['username'],
            'source_type': 'ECOUPON_150_ACTIVATED',
            'source_id': r['submission_id'],
            'details': f"E-Coupon 150 - {r['coupon_code']}",
            'created_at': r['created_at'],
        })
    
    # Sort by user_id and created_at
    combined_source_rows.sort(key=lambda x: (x['user_id'], str(x['created_at'])))
    
    with open(sources_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = [
            'user_id', 'username', 'source_type', 'source_id', 'details', 'created_at'
        ]
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in combined_source_rows:
            w.writerow(r)
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"PROMO MATRIX ANALYSIS - WINDOW: {DAYS} days")
    print(f"{'='*60}")
    print(f"Total users with activity: {len(analysis_rows)}")
    print(f"\nTransaction Sources:")
    print(f"  Promo purchases: {len(purchase_detail_rows)}")
    print(f"  Self Account allocations (₹250): {sum(1 for _ in self_alloc_detail_rows)}")
    print(f"  E-Coupon 150 activations: {sum(1 for _ in ecoupon_detail_rows)}")
    print(f"  Total transaction sources: {len(combined_source_rows)}")
    print(f"\nMatrix Accounts:")
    print(f"  Total matrix accounts (including duplicates): {len(account_detail_rows)}")
    print(f"  Detected duplicate accounts: {duplicate_count}")
    
    # Count discrepancies
    discrepancy_users = [r for r in analysis_rows if r['has_discrepancies'] == 'YES']
    print(f"  Users with discrepancies: {len(discrepancy_users)}")
    
    # Breakdown of discrepancies
    extra_five_users = [r for r in analysis_rows if r['extra_five'] > 0]
    extra_three_users = [r for r in analysis_rows if r['extra_three'] > 0]
    missing_five_users = [r for r in analysis_rows if r['missing_five'] > 0]
    missing_three_users = [r for r in analysis_rows if r['missing_three'] > 0]
    
    print(f"\nDiscrepancy Breakdown:")
    print(f"  Users with extra FIVE_150: {len(extra_five_users)} (total extra: {sum(r['extra_five'] for r in extra_five_users)})")
    print(f"  Users with extra THREE_150: {len(extra_three_users)} (total extra: {sum(r['extra_three'] for r in extra_three_users)})")
    print(f"  Users with missing FIVE_150: {len(missing_five_users)} (total missing: {sum(r['missing_five'] for r in missing_five_users)})")
    print(f"  Users with missing THREE_150: {len(missing_three_users)} (total missing: {sum(r['missing_three'] for r in missing_three_users)})")
    
    print(f"\nOutput files:")
    print(f"  1. {analysis_path}")
    print(f"  2. {details_path}")
    print(f"  3. {purchases_path}")
    print(f"  4. {sources_path}")
    print(f"{'='*60}\n")


if __name__ == '__main__':
    run()

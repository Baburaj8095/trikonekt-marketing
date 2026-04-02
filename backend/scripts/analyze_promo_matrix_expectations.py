"""
Analyze promo purchases in a lookback window and compute expected vs actual matrix openings.

Outputs CSV to `promo_matrix_expectations_<ts>.csv` with columns:
  user_id, username, total_purchases, qty_150, qty_750_plus, expected_five, expected_three, actual_five, actual_three, extra_five, extra_three

Rules applied:
- PRIME 150: each approved purchase unit => 1 FIVE and 1 THREE
- PRIME >=750 (e.g., 750, 1000): only the user's first approved purchase for that package code opens matrices (subsequent approved purchases for same package do not)
- MONTHLY packages: ignored for matrix expectation (handled separately)

Run:
  python backend/manage.py shell -c "exec(open('backend/scripts/analyze_promo_matrix_expectations.py').read())"

"""
import csv
import os
from datetime import datetime, timedelta
from django.utils import timezone

DAYS = int(os.environ.get('DAYS', '60'))
OUT_DIR = os.getcwd()


def run():
    from business.models import PromoPurchase, AutoPoolAccount
    from django.db.models import Sum

    cutoff = timezone.now() - timedelta(days=DAYS)
    purchases = (
        PromoPurchase.objects.filter(status='APPROVED', approved_at__gte=cutoff)
        .select_related('package', 'user')
        .order_by('user_id', 'approved_at')
    )

    # Group purchases by user
    users = {}
    for p in purchases:
        uid = p.user_id
        users.setdefault(uid, {'user': p.user, 'purchases': []})
        users[uid]['purchases'].append(p)

    out_rows = []
    for uid, data in users.items():
        user = data['user']
        ps = data['purchases']
        total_purchases = len(ps)
        qty_150 = 0
        qty_750_plus = 0
        expected_five = 0
        expected_three = 0

        # Track first approved per package.code for >=750 rules
        seen_package_first = set()

        for p in ps:
            code = getattr(p.package, 'code', '')
            price = float(getattr(p.package, 'price', 0) or 0)
            qty = int(getattr(p, 'quantity', 1) or 1)

            if price <= 200:  # treat as 150
                qty_150 += qty
                expected_five += qty
                expected_three += qty
            elif price >= 750:
                qty_750_plus += qty
                # Only first approved purchase for this package code opens matrices
                if code not in seen_package_first:
                    expected_five += qty
                    expected_three += qty
                    seen_package_first.add(code)
                else:
                    # subsequent purchase -> no new matrices
                    pass
            else:
                # fallback: treat as single matrix opening
                expected_five += qty
                expected_three += qty

        # Actual counts in window
        actual_five = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='FIVE_150', created_at__gte=cutoff).count()
        actual_three = AutoPoolAccount.objects.filter(owner_id=uid, pool_type='THREE_150', created_at__gte=cutoff).count()

        extra_five = actual_five - expected_five
        extra_three = actual_three - expected_three

        out_rows.append({
            'user_id': uid,
            'username': getattr(user, 'username', '') if user else '',
            'total_purchases': total_purchases,
            'qty_150': qty_150,
            'qty_750_plus': qty_750_plus,
            'expected_five': expected_five,
            'expected_three': expected_three,
            'actual_five': actual_five,
            'actual_three': actual_three,
            'extra_five': extra_five,
            'extra_three': extra_three,
        })

    ts = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    out_path = os.path.join(OUT_DIR, f'promo_matrix_expectations_{ts}.csv')
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = ['user_id','username','total_purchases','qty_150','qty_750_plus','expected_five','expected_three','actual_five','actual_three','extra_five','extra_three']
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in out_rows:
            w.writerow(r)

    print(f'Wrote analysis CSV: {out_path}')


if __name__ == '__main__':
    run()

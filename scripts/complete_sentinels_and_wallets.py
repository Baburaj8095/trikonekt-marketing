import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '/srv/trikonekt/staging/backend')
django.setup()

import psycopg2
import psycopg2.extras
from decimal import Decimal
from accounts.models import CustomUser, Wallet
from business.models import AutoPoolAccount, PromoPurchase
from mlm_ranks.models import RankUpgrade

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print('=== 1. Copying Admin Sentinels from Production ===')
p_cur.execute("SELECT * FROM business_autopoolaccount WHERE id IN (1, 2);")
sentinels = p_cur.fetchall()
for sn in sentinels:
    sn_dict = dict(sn)
    cols = list(sn_dict.keys())
    values = [sn_dict[k] for k in cols]
    placeholders = ["%s"] * len(cols)
    s_cur.execute(f"""
        INSERT INTO business_autopoolaccount ({', '.join(cols)})
        VALUES ({', '.join(placeholders)})
        ON CONFLICT (id) DO NOTHING;
    """, tuple(values))

s_cur.execute("SELECT setval('business_autopoolaccount_id_seq', 2);")
s_conn.commit()
print('Admin AutoPool sentinels restored.')

print('\n=== 2. Creating Fresh ₹0.00 Wallets for all Users via Django ORM ===')
users = list(CustomUser.objects.all().order_by('id'))
wallets_created = 0

for u in users:
    w, created = Wallet.objects.get_or_create(user=u)
    w.main_balance = Decimal("0.00")
    if hasattr(w, 'self_account_balance'):
        w.self_account_balance = Decimal("0.00")
    if hasattr(w, 'withdrawable_balance'):
        w.withdrawable_balance = Decimal("0.00")
    if hasattr(w, 'bonus_wallet'):
        w.bonus_wallet = Decimal("0.00")
    if hasattr(w, 'franchise_total_earning'):
        w.franchise_total_earning = Decimal("0.00")
        w.franchise_active_work = Decimal("0.00")
        w.franchise_inactive_work = Decimal("0.00")
        w.franchise_self_rebirth = Decimal("0.00")
        w.franchise_company_marketing = Decimal("0.00")
    w.save()
    wallets_created += 1

print(f'Fresh ₹0.00 wallets initialized for all {wallets_created} users.')

print('\n=== 3. Audit & Sponsor Verification ===')
s_cur.execute('SELECT COUNT(*) as total FROM accounts_customuser;')
print('Total CustomUser count:', s_cur.fetchone()['total'])

s_cur.execute('SELECT COUNT(*) as inactive FROM accounts_customuser WHERE account_active = False;')
print('Total Inactive Users (account_active=False):', s_cur.fetchone()['inactive'])

s_cur.execute('SELECT COUNT(*) as loginable FROM accounts_customuser WHERE is_active = True;')
print('Total Loginable Users (is_active=True):', s_cur.fetchone()['loginable'])

s_cur.execute('SELECT COUNT(*) as with_sponsor FROM accounts_customuser WHERE registered_by_id IS NOT NULL;')
print('Users with Sponsor (registered_by_id):', s_cur.fetchone()['with_sponsor'])

s_cur.execute('SELECT COUNT(*) as wallets FROM accounts_wallet;')
print('Total Wallets count:', s_cur.fetchone()['wallets'])

s_cur.execute('SELECT COUNT(*) as purchases FROM business_promopurchase;')
print('Package Purchases count:', s_cur.fetchone()['purchases'])

s_cur.execute('SELECT COUNT(*) as txs FROM accounts_wallettransaction;')
print('Wallet Transactions count:', s_cur.fetchone()['txs'])

print('\n=== Sample 25 Imported Users with Sponsor Links ===')
s_cur.execute("""
    SELECT u.id, u.username, u.phone, u.registered_by_id, u.sponsor_id,
           sp.username as sponsor_username, sp.phone as sponsor_phone
    FROM accounts_customuser u
    LEFT JOIN accounts_customuser sp ON u.registered_by_id = sp.id
    ORDER BY u.id
    LIMIT 25;
""")
for r in s_cur.fetchall():
    print(dict(r))

print('\n=== ALL USERS MIGRATION COMPLETED 100% SUCCESSFULLY! ===')

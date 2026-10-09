import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '/srv/trikonekt/staging/backend')
django.setup()

import psycopg2
import psycopg2.extras
from decimal import Decimal
from django.contrib.auth.hashers import make_password

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. COPYING LOCATIONS (Countries, States, Cities) ===")
# 1. Countries
p_cur.execute("SELECT * FROM locations_country;")
countries = p_cur.fetchall()
for c in countries:
    c_dict = dict(c)
    cols = list(c_dict.keys())
    values = [c_dict[k] for k in cols]
    placeholders = ["%s"] * len(cols)
    s_cur.execute(f"INSERT INTO locations_country ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) ON CONFLICT (id) DO NOTHING;", tuple(values))

# 2. States
p_cur.execute("SELECT * FROM locations_state;")
states = p_cur.fetchall()
for st in states:
    st_dict = dict(st)
    cols = list(st_dict.keys())
    values = [st_dict[k] for k in cols]
    placeholders = ["%s"] * len(cols)
    s_cur.execute(f"INSERT INTO locations_state ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) ON CONFLICT (id) DO NOTHING;", tuple(values))

# 3. Cities
p_cur.execute("SELECT * FROM locations_city;")
cities = p_cur.fetchall()
for ct in cities:
    ct_dict = dict(ct)
    cols = list(ct_dict.keys())
    values = [ct_dict[k] for k in cols]
    placeholders = ["%s"] * len(cols)
    s_cur.execute(f"INSERT INTO locations_city ({', '.join(cols)}) VALUES ({', '.join(placeholders)}) ON CONFLICT (id) DO NOTHING;", tuple(values))

s_conn.commit()
print(f"Locations copied: {len(countries)} countries, {len(states)} states, {len(cities)} cities.")

print("\n=== 2. EXTRACTING REAL ACTIVE USERS FROM PRODUCTION (growth.vin.in) ===")
# Exclude test series: 1010000001-1010000011, 80959181*, 080959181*, and SIM%
p_cur.execute("""
    SELECT u.*
    FROM accounts_customuser u
    WHERE (u.account_active = True 
       OR u.id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR u.id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount)
       OR u.id = 1)
      AND u.username NOT LIKE '10100000%'
      AND u.phone NOT LIKE '10100000%'
      AND u.username NOT LIKE '80959181%'
      AND u.phone NOT LIKE '80959181%'
      AND u.username NOT LIKE '080959181%'
      AND u.phone NOT LIKE '080959181%'
      AND u.username NOT LIKE 'SIM%'
    ORDER BY u.id;
""")
prod_users = p_cur.fetchall()
print(f"Total Real Active Users Extracted from Production: {len(prod_users)}")

# Build user set & check all registered_by sponsors
user_ids = {u['id'] for u in prod_users}
missing_sponsors = set()
for u in prod_users:
    if u['registered_by_id'] and u['registered_by_id'] not in user_ids:
        missing_sponsors.add(u['registered_by_id'])

if missing_sponsors:
    print(f"Resolving {len(missing_sponsors)} upline anchors (IDs: {missing_sponsors})...")
    p_cur.execute("SELECT u.* FROM accounts_customuser u WHERE u.id IN %s;", (tuple(missing_sponsors),))
    extra = p_cur.fetchall()
    prod_users.extend(extra)
    prod_users.sort(key=lambda x: x['id'])

user_ids = {u['id'] for u in prod_users}
print(f"Total Users to Import into Staging: {len(prod_users)}")

# Get Staging columns
s_cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts_customuser';")
staging_cols = {r['column_name'] for r in s_cur.fetchall()}

default_hashed_pwd = make_password("Tri@2026")
print(f"Generated hashed password for 'Tri@2026': {default_hashed_pwd[:25]}...")

print("\n=== 3. PURGING STAGING USERS & LEDGERS VIA CASCADE TRUNCATE ===")
s_cur.execute("TRUNCATE TABLE accounts_customuser CASCADE;")
s_conn.commit()
print("Staging customuser and all dependent tables truncated cleanly.")

print("\n=== 4. BULK INSERTING USERS INTO accounts_customuser ===")
inserted = 0

for u in prod_users:
    u_dict = dict(u)
    uid = u_dict['id']
    
    # Overrides per requirement:
    u_dict['account_active'] = False  # Fresh unpurchased status
    u_dict['is_active'] = True       # Active login status
    u_dict['password'] = default_hashed_pwd  # Tri@2026

    # Validate self-referencing foreign keys:
    if u_dict.get('parent_id') and u_dict['parent_id'] not in user_ids:
        u_dict['parent_id'] = None
        
    if u_dict.get('registered_by_id') and u_dict['registered_by_id'] not in user_ids:
        u_dict['registered_by_id'] = 1  # Fallback to admin root sentinel

    # Keep only columns that exist on staging
    valid_data = {k: v for k, v in u_dict.items() if k in staging_cols}
    
    cols = list(valid_data.keys())
    placeholders = ["%s"] * len(cols)
    values = [valid_data[k] for k in cols]
    sql = f"INSERT INTO accounts_customuser ({', '.join(cols)}) VALUES ({', '.join(placeholders)});"
    s_cur.execute(sql, tuple(values))
    inserted += 1

s_conn.commit()
print(f"Successfully inserted {inserted} users into accounts_customuser.")

# Update Postgres sequence
s_cur.execute("SELECT setval('accounts_customuser_id_seq', (SELECT MAX(id) FROM accounts_customuser));")
s_conn.commit()
print("PostgreSQL sequence updated.")

print("\n=== 5. CREATING ADMIN AUTO-POOL SENTINELS (ID 1 & ID 2) ===")
s_cur.execute("""
    INSERT INTO business_autopoolaccount (id, pool_type, owner_id, parent_account_id, position, created_at, updated_at)
    VALUES 
        (1, 'FIVE_150', 1, NULL, NULL, NOW(), NOW()),
        (2, 'THREE_150', 1, NULL, NULL, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
""")
s_cur.execute("SELECT setval('business_autopoolaccount_id_seq', 2);")
s_conn.commit()
print("Admin AutoPool sentinels restored (FIVE_150 ID:1, THREE_150 ID:2).")

print("\n=== 6. CREATING FRESH ₹0.00 WALLETS FOR ALL USERS ===")
s_cur.execute("SELECT id FROM accounts_customuser;")
all_uids = [r['id'] for r in s_cur.fetchall()]

for uid in all_uids:
    s_cur.execute("""
        INSERT INTO accounts_wallet (
            user_id, balance, main_balance, withdrawable_balance, self_account_balance,
            bonus_wallet, total_earnings, total_withdrawn, franchise_total_earning,
            franchise_active_work, franchise_inactive_work, franchise_self_rebirth, franchise_company_marketing,
            created_at, updated_at
        ) VALUES (
            %s, 0.00, 0.00, 0.00, 0.00,
            0.00, 0.00, 0.00, 0.00,
            0.00, 0.00, 0.00, 0.00,
            NOW(), NOW()
        );
    """, (uid,))

s_conn.commit()
print(f"Fresh ₹0.00 wallets created for all {len(all_uids)} users.")

print("\n=== 7. POST-MIGRATION AUDIT & SPONSOR HIERARCHY VERIFICATION ===")
s_cur.execute("SELECT COUNT(*) as total_users FROM accounts_customuser;")
print("Total Staging Users: " + str(s_cur.fetchone()['total_users']))

s_cur.execute("SELECT COUNT(*) as inactive_users FROM accounts_customuser WHERE account_active = False;")
print("Inactive (Unpurchased) Users: " + str(s_cur.fetchone()['inactive_users']))

s_cur.execute("SELECT COUNT(*) as active_login FROM accounts_customuser WHERE is_active = True;")
print("Loginable Users (is_active=True): " + str(s_cur.fetchone()['active_login']))

s_cur.execute("SELECT COUNT(*) as with_sponsor FROM accounts_customuser WHERE registered_by_id IS NOT NULL;")
print("Users with valid Sponsor (registered_by_id): " + str(s_cur.fetchone()['with_sponsor']))

s_cur.execute("SELECT COUNT(*) as wallet_cnt FROM accounts_wallet WHERE balance = 0.00;")
print("Wallets at ₹0.00: " + str(s_cur.fetchone()['wallet_cnt']))

s_cur.execute("SELECT COUNT(*) as pkg_cnt FROM business_promopurchase;")
print("Package Purchases count: " + str(s_cur.fetchone()['pkg_cnt']))

s_cur.execute("SELECT COUNT(*) as tx_cnt FROM accounts_wallettransaction;")
print("Wallet Transactions count: " + str(s_cur.fetchone()['tx_cnt']))

print("\n=== SAMPLE IMPORTED USERS WITH SPONSOR TREE ===")
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

print("\n=== IMPORT AND WALLET RESET COMPLETED 100% SUCCESSFULLY! ===")

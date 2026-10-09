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

print("=== 1. FETCHING TARGET USERS FROM PRODUCTION (growth.vin.in) ===")
# Fetch all users who have account_active=True or completed purchases or autopool accounts in prod
p_cur.execute("""
    SELECT 
        u.id, u.password, u.last_login, u.is_superuser, u.username, u.first_name, u.last_name, 
        u.email, u.is_staff, u.is_active, u.date_joined, u.phone, u.role, u.category, 
        u.sponsor_id, u.registered_by_id, u.autopool_enabled, u.registration_order, 
        u.district, u.state, u.pincode
    FROM accounts_customuser u
    WHERE u.account_active = True 
       OR u.id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR u.id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount)
       OR u.id = 1
    ORDER BY u.id;
""")
prod_users = p_cur.fetchall()
print(f"Total Target Users Extracted from Production: {len(prod_users)}")

# Also make sure all registered_by sponsors exist in our import set
user_ids = {u['id'] for u in prod_users}
missing_sponsors = set()
for u in prod_users:
    if u['registered_by_id'] and u['registered_by_id'] not in user_ids:
        missing_sponsors.add(u['registered_by_id'])

if missing_sponsors:
    print(f"Fetching {len(missing_sponsors)} missing parent sponsors to maintain 100% tree integrity...")
    p_cur.execute("""
        SELECT 
            u.id, u.password, u.last_login, u.is_superuser, u.username, u.first_name, u.last_name, 
            u.email, u.is_staff, u.is_active, u.date_joined, u.phone, u.role, u.category, 
            u.sponsor_id, u.registered_by_id, u.autopool_enabled, u.registration_order, 
            u.district, u.state, u.pincode
        FROM accounts_customuser u
        WHERE u.id IN %s;
    """, (tuple(missing_sponsors),))
    extra_sponsors = p_cur.fetchall()
    prod_users.extend(extra_sponsors)
    # Sort again by ID so parents are inserted before children
    prod_users.sort(key=lambda x: x['id'])
    print(f"Total users to import including necessary upline anchors: {len(prod_users)}")

default_hashed_pwd = make_password("Tri@2026")
print(f"Generated hashed password for 'Tri@2026': {default_hashed_pwd[:25]}...")

print("\n=== 2. IMPORTING USERS INTO STAGING DATABASE (asiyapp.com) ===")
# We will insert or update accounts_customuser
inserted = 0
updated = 0

for u in prod_users:
    uid = u['id']
    uname = u['username']
    phone = u['phone']
    email = u['email'] or ""
    first_name = u['first_name'] or ""
    last_name = u['last_name'] or ""
    role = u['role'] or "user"
    category = u['category'] or "consumer"
    is_superuser = bool(u['is_superuser'])
    is_staff = bool(u['is_staff'])
    is_active = True  # Can log in
    account_active = False  # Fresh unpurchased status
    reg_by_id = u['registered_by_id']
    date_joined = u['date_joined']
    
    # Check if user already exists in staging
    s_cur.execute("SELECT id FROM accounts_customuser WHERE id = %s;", (uid,))
    existing = s_cur.fetchone()
    
    if existing:
        s_cur.execute("""
            UPDATE accounts_customuser SET
                username = %s,
                phone = %s,
                email = %s,
                first_name = %s,
                last_name = %s,
                role = %s,
                category = %s,
                is_superuser = %s,
                is_staff = %s,
                is_active = %s,
                account_active = %s,
                password = %s,
                registered_by_id = %s,
                date_joined = %s
            WHERE id = %s;
        """, (uname, phone, email, first_name, last_name, role, category, is_superuser, is_staff, is_active, account_active, default_hashed_pwd, reg_by_id, date_joined, uid))
        updated += 1
    else:
        s_cur.execute("""
            INSERT INTO accounts_customuser (
                id, username, phone, email, first_name, last_name, role, category,
                is_superuser, is_staff, is_active, account_active, password, registered_by_id, date_joined
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s
            );
        """, (uid, uname, phone, email, first_name, last_name, role, category, is_superuser, is_staff, is_active, account_active, default_hashed_pwd, reg_by_id, date_joined))
        inserted += 1

s_conn.commit()
print(f"Users imported into staging: {inserted} inserted, {updated} updated (Total: {inserted + updated})")

# Update Postgres sequence so next new user gets max(id) + 1
s_cur.execute("SELECT setval('accounts_customuser_id_seq', (SELECT MAX(id) FROM accounts_customuser));")
s_conn.commit()
print("PostgreSQL sequence 'accounts_customuser_id_seq' updated successfully.")

print("\n=== 3. INITIALIZING FRESH ₹0.00 WALLETS FOR ALL USERS ===")
s_cur.execute("SELECT id FROM accounts_customuser;")
all_staging_uids = [r['id'] for r in s_cur.fetchall()]

wallets_created = 0
wallets_reset = 0

for uid in all_staging_uids:
    s_cur.execute("SELECT id FROM accounts_wallet WHERE user_id = %s;", (uid,))
    w = s_cur.fetchone()
    if w:
        s_cur.execute("""
            UPDATE accounts_wallet SET
                balance = 0.00,
                main_balance = 0.00,
                withdrawable_balance = 0.00,
                self_account_balance = 0.00,
                bonus_wallet = 0.00,
                total_earnings = 0.00,
                total_withdrawn = 0.00,
                franchise_total_earning = 0.00,
                franchise_active_work = 0.00,
                franchise_inactive_work = 0.00,
                franchise_self_rebirth = 0.00,
                franchise_company_marketing = 0.00
            WHERE user_id = %s;
        """, (uid,))
        wallets_reset += 1
    else:
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
        wallets_created += 1

s_conn.commit()
print(f"Wallets synchronized: {wallets_created} created, {wallets_reset} reset to 0.00 (Total: {wallets_created + wallets_reset})")

print("\n=== 4. POST-MIGRATION SANITY CHECK ===")
s_cur.execute("SELECT COUNT(*) as cnt FROM accounts_customuser;")
print("Total Staging CustomUser count: " + str(s_cur.fetchone()['cnt']))

s_cur.execute("SELECT COUNT(*) as cnt FROM accounts_customuser WHERE account_active = False;")
print("Total Staging Inactive (Fresh) Users: " + str(s_cur.fetchone()['cnt']))

s_cur.execute("SELECT COUNT(*) as cnt FROM accounts_customuser WHERE is_active = True;")
print("Total Staging Loginable (is_active=True) Users: " + str(s_cur.fetchone()['cnt']))

s_cur.execute("SELECT COUNT(*) as cnt FROM accounts_wallet WHERE balance = 0.00;")
print("Total Staging Wallets at ₹0.00: " + str(s_cur.fetchone()['cnt']))

s_cur.execute("SELECT COUNT(*) as cnt FROM business_promopurchase;")
print("Total Staging PromoPurchase count: " + str(s_cur.fetchone()['cnt']))

s_cur.execute("SELECT COUNT(*) as cnt FROM accounts_wallettransaction;")
print("Total Staging WalletTransaction count: " + str(s_cur.fetchone()['cnt']))

print("\n=== IMPORT FINISHED CLEANLY AND SUCCESSFULLY! ===")

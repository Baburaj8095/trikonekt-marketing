import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

p_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active, date_joined FROM accounts_customuser ORDER BY id;")
prod_users = {r["id"]: r for r in p_cur.fetchall()}

s_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active, date_joined FROM accounts_customuser ORDER BY id;")
staging_users = {r["id"]: r for r in s_cur.fetchall()}

print("==========================================================================================")
print("                       PRODUCTION VS STAGING USER DATABASE AUDIT                          ")
print("==========================================================================================")
print(f"Total Users in PRODUCTION Database : {len(prod_users)}")
print(f"Total Users in STAGING Database    : {len(staging_users)}")
print("------------------------------------------------------------------------------------------")

prod_ids = set(prod_users.keys())
staging_ids = set(staging_users.keys())

deleted_in_staging = sorted(list(prod_ids - staging_ids))
added_in_staging = sorted(list(staging_ids - prod_ids))

print(f"Total User IDs in PROD but DELETED/MISSING in STAGING : {len(deleted_in_staging)}")
print(f"Total User IDs in STAGING but not in PROD (New/Added) : {len(added_in_staging)}")
print("==========================================================================================")

if deleted_in_staging:
    print(f"\n--- LIST OF ALL {len(deleted_in_staging)} DELETED / MISSING USER IDs IN STAGING ---")
    print("Deleted IDs:", deleted_in_staging)
    print("-" * 105)
    print(f"{'ID':<6} | {'Phone':<12} | {'Username':<18} | {'Full Name':<28} | {'Role':<10} | {'Status'}")
    print("-" * 105)
    for uid in deleted_in_staging:
        u = prod_users[uid]
        name = str(u['full_name'] or '-')
        phone = str(u['phone'] or '-')
        username = str(u['username'] or '-')
        role = str(u['role'] or '-')
        act = "Active" if u['account_active'] else "Inactive"
        print(f"#{u['id']:<5} | {phone:<12} | {username:<18} | {name:<28} | {role:<10} | {act}")

if added_in_staging:
    print(f"\n--- LIST OF ALL {len(added_in_staging)} NEW / ADDED USER IDs IN STAGING ---")
    print("Added IDs:", added_in_staging)
    print("-" * 105)
    print(f"{'ID':<6} | {'Phone':<12} | {'Username':<18} | {'Full Name':<28} | {'Role':<10} | {'Status'}")
    print("-" * 105)
    for uid in added_in_staging:
        u = staging_users[uid]
        name = str(u['full_name'] or '-')
        phone = str(u['phone'] or '-')
        username = str(u['username'] or '-')
        role = str(u['role'] or '-')
        act = "Active" if u['account_active'] else "Inactive"
        print(f"#{u['id']:<5} | {phone:<12} | {username:<18} | {name:<28} | {role:<10} | {act}")

print("\n==========================================================================================")

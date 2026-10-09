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

print("==================================================")
print("       PROD VS STAGING USER COMPARISON REPORT     ")
print("==================================================")
print(f"Total Users in PRODUCTION DB : {len(prod_users)}")
print(f"Total Users in STAGING DB    : {len(staging_users)}")
print("--------------------------------------------------")

prod_ids = set(prod_users.keys())
staging_ids = set(staging_users.keys())

deleted_in_staging = sorted(list(prod_ids - staging_ids))
added_in_staging = sorted(list(staging_ids - prod_ids))

print(f"Total User IDs in PROD but MISSING/DELETED in STAGING : {len(deleted_in_staging)}")
print(f"Total User IDs in STAGING but not in PROD (New/Custom): {len(added_in_staging)}")
print("==================================================")

if deleted_in_staging:
    print("\n--- LIST OF ALL DELETED/MISSING IDs IN STAGING ---")
    for uid in deleted_in_staging:
        u = prod_users[uid]
        print(f"ID #{u['id']:<4} | Phone: {u['phone']:<12} | Name: {str(u['full_name']):<25} | Role: {str(u['role']):<10} | Category: {str(u['category']):<12} | Active: {u['account_active']}")

if added_in_staging:
    print("\n--- LIST OF NEW/ADDED IDs IN STAGING ---")
    for uid in added_in_staging:
        u = staging_users[uid]
        print(f"ID #{u['id']:<4} | Phone: {u['phone']:<12} | Name: {str(u['full_name']):<25} | Role: {str(u['role']):<10} | Category: {str(u['category']):<12} | Active: {u['account_active']}")

print("\n==================================================")

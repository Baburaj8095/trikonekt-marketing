import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

p_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active FROM accounts_customuser ORDER BY id;")
prod_users = {r["id"]: r for r in p_cur.fetchall()}
s_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active FROM accounts_customuser ORDER BY id;")
staging_users = {r["id"]: r for r in s_cur.fetchall()}

p_ids = set(prod_users.keys())
s_ids = set(staging_users.keys())

del_ids = sorted(list(p_ids - s_ids))
add_ids = sorted(list(s_ids - p_ids))
common_ids = sorted(list(p_ids & s_ids))

print("==========================================================================")
print(f"TOTAL USERS IN PRODUCTION RDS   : {len(p_ids)}")
print(f"TOTAL USERS IN STAGING RDS      : {len(s_ids)}")
print(f"MATCHED USERS IN BOTH (PRESERVED): {len(common_ids)}")
print(f"TOTAL IDS MISSING / DELETED IN STAGING : {len(del_ids)}")
print(f"TOTAL NEW IDS CREATED IN STAGING: {len(add_ids)}")
print("==========================================================================")

del_active = [uid for uid in del_ids if prod_users[uid]["account_active"]]
del_inactive = [uid for uid in del_ids if not prod_users[uid]["account_active"]]

print(f"\nBreakdown of the {len(del_ids)} Deleted/Missing IDs:")
print(f" - Active in Prod   : {len(del_active)}")
print(f" - Inactive in Prod : {len(del_inactive)}")
print(f"\nAll Deleted IDs: {del_ids}")
print(f"\nAll Added IDs in Staging: {add_ids}")

if del_active:
    print("\nDetails of Active Users in Prod that are deleted in Staging:")
    for uid in del_active:
        u = prod_users[uid]
        print(f"ID #{u['id']}: phone={u['phone']}, username={u['username']}, name={u['full_name']}")

print("\nSample of Inactive Users deleted in Staging (first 10):")
for uid in del_inactive[:10]:
    u = prod_users[uid]
    print(f"ID #{u['id']}: phone={u['phone']}, username={u['username']}, name={u['full_name']}")

print("==========================================================================")

import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

p_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active FROM accounts_customuser;")
p_users = {r["id"]: r for r in p_cur.fetchall()}
s_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active FROM accounts_customuser;")
s_users = {r["id"]: r for r in s_cur.fetchall()}

p_ids = set(p_users.keys())
s_ids = set(s_users.keys())

del_ids = p_ids - s_ids
add_ids = s_ids - p_ids
common_ids = p_ids & s_ids

print("==========================================================================")
print("              PROD VS STAGING DATABASE DETAILED BREAKDOWN                 ")
print("==========================================================================")
print(f"Total Users in Production Database : {len(p_ids):,}")
print(f"Total Users in Staging Database    : {len(s_ids):,}")
print(f"Total Preserved/Matching in Both   : {len(common_ids):,}")
print(f"Total IDs Missing/Deleted in Staging: {len(del_ids):,}")
print(f"Total New Test IDs Added in Staging: {len(add_ids):,}")
print("--------------------------------------------------------------------------")

del_active = [uid for uid in del_ids if p_users[uid]["account_active"]]
del_inactive = [uid for uid in del_ids if not p_users[uid]["account_active"]]

print(f"Of the {len(del_ids)} deleted/missing records:")
print(f"  • Active Users in Prod   : {len(del_active):,}")
print(f"  • Inactive Users in Prod : {len(del_inactive):,}")
print("--------------------------------------------------------------------------")

# Breakdown by role:category for deleted users
del_categories = {}
for uid in del_ids:
    r = p_users[uid]["role"] or "None"
    c = p_users[uid]["category"] or "None"
    k = f"role={r} | category={c}"
    del_categories[k] = del_categories.get(k, 0) + 1

print("Deleted Users Breakdown by Role & Category:")
for k, cnt in sorted(del_categories.items(), key=lambda x: x[1], reverse=True):
    print(f"  • {k:<35}: {cnt:>5} users")

# Test user IDs specifically mentioned in previous tasks (e.g., 101, 102, 103, 104, 105, 8095918105, 0000000001)
test_candidates = [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]
print("\nTest User ID Status in Staging:")
for t_id in test_candidates:
    in_prod = t_id in p_ids
    in_staging = t_id in s_ids
    print(f"  • ID #{t_id}: in Prod = {in_prod}, in Staging = {in_staging}")

print("\nMin/Max IDs:")
print(f"  • Production ID Range : #{min(p_ids)} to #{max(p_ids)}")
print(f"  • Staging ID Range    : #{min(s_ids)} to #{max(s_ids)}")
print("==========================================================================")

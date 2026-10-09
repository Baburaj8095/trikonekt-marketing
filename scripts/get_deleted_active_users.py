import psycopg2
import psycopg2.extras
import json

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

p_cur.execute("""
    SELECT u.id, u.username, u.phone, u.full_name, u.role, u.category, u.account_active, u.date_joined,
           u.sponsor_id,
           (SELECT COUNT(*) FROM business_promopurchase p WHERE p.user_id = u.id AND p.status IN ('approved', 'completed', 'APPROVED', 'COMPLETED')) as purchases_count
    FROM accounts_customuser u
    ORDER BY u.id;
""")
p_users = {r["id"]: r for r in p_cur.fetchall()}

s_cur.execute("SELECT id FROM accounts_customuser;")
s_ids = set(r["id"] for r in s_cur.fetchall())

del_active_users = [
    u for uid, u in p_users.items()
    if uid not in s_ids and u["account_active"]
]

print(f"TOTAL ACTIVE USERS IN PROD DELETED/MISSING IN STAGING: {len(del_active_users)}")

# Write to json file for structured reporting
with open("/tmp/deleted_active_users.json", "w") as f:
    json.dump(del_active_users, f, default=str, indent=2)

print("\nSample first 30 active users missing in staging:")
print("-" * 110)
print(f"{'ID':<6} | {'Phone':<12} | {'Username':<18} | {'Full Name':<28} | {'Sponsor ID':<12} | {'Purchases'}")
print("-" * 110)
for u in del_active_users[:30]:
    name = str(u['full_name'] or '-')
    phone = str(u['phone'] or '-')
    username = str(u['username'] or '-')
    sponsor = str(u['sponsor_id'] or '-')
    print(f"#{u['id']:<5} | {phone:<12} | {username:<18} | {name:<28} | {sponsor:<12} | {u['purchases_count']}")

print("--------------------------------------------------------------------------------------------------------------")

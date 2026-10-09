import psycopg2
import psycopg2.extras
import json
from datetime import datetime

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
conn = psycopg2.connect(prod_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. PRODUCTION DATABASE (growth.vin) USER STATS ===")
cur.execute("SELECT COUNT(*) as total FROM accounts_customuser;")
total = cur.fetchone()['total']
print("Total Users in Production: " + str(total))

cur.execute("SELECT COUNT(*) as active_acc FROM accounts_customuser WHERE account_active = True;")
active_acc = cur.fetchone()['active_acc']
print("Users with account_active = True: " + str(active_acc))

cur.execute("SELECT COUNT(*) as is_active_cnt FROM accounts_customuser WHERE is_active = True;")
is_active_cnt = cur.fetchone()['is_active_cnt']
print("Users with is_active = True: " + str(is_active_cnt))

print("\n=== 2. Users with Package Purchases in Production ===")
cur.execute("SELECT COUNT(DISTINCT user_id) as buyers FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED');")
buyers = cur.fetchone()['buyers']
print("Distinct Buyers with Approved/Completed PromoPurchase: " + str(buyers))

cur.execute("SELECT COUNT(DISTINCT owner_id) as matrix_owners FROM business_autopoolaccount;")
matrix_owners = cur.fetchone()['matrix_owners']
print("Distinct Users in AutoPoolAccount: " + str(matrix_owners))

print("\n=== 3. Inspecting Columns of accounts_customuser in Prod ===")
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'accounts_customuser' ORDER BY ordinal_position;")
cols = cur.fetchall()
print([c['column_name'] for c in cols])

print("\n=== 4. Breakdown of Active Users by Criteria ===")
# Users with active account or completed purchase or matrix node
cur.execute("""
    SELECT 
        u.id, u.username, u.phone, u.email, u.first_name, u.last_name, u.role, u.category, 
        u.account_active, u.is_active, u.registered_by_id, u.date_joined,
        (SELECT COUNT(*) FROM business_promopurchase p WHERE p.user_id = u.id AND p.status IN ('approved', 'completed', 'APPROVED', 'COMPLETED')) as purchase_count,
        (SELECT COUNT(*) FROM business_autopoolaccount a WHERE a.owner_id = u.id) as pool_nodes
    FROM accounts_customuser u
    WHERE u.account_active = True 
       OR u.id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR u.id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount)
    ORDER BY u.id;
""")
active_users = cur.fetchall()
print("Total Targeted Active Users from Growth: " + str(len(active_users)))
for u in active_users[:30]:
    print(dict(u))

if len(active_users) > 30:
    print("... and " + str(len(active_users) - 30) + " more active users.")

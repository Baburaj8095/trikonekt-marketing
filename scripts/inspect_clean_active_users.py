import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
conn = psycopg2.connect(prod_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Excluded users
cur.execute("""
    SELECT id, username, phone, registered_by_id, sponsor_id
    FROM accounts_customuser
    WHERE username LIKE '10100000%' 
       OR phone LIKE '10100000%' 
       OR username LIKE '80959181%' 
       OR phone LIKE '80959181%'
       OR username LIKE '080959181%'
       OR phone LIKE '080959181%';
""")
excluded = cur.fetchall()
excluded_ids = [r['id'] for r in excluded]
excluded_unames = [r['username'] for r in excluded]
excluded_phones = [r['phone'] for r in excluded if r['phone']]

print(f"Total excluded test series users: {len(excluded)}")
print("Excluded IDs:", excluded_ids)

# 2. Check downlines of excluded users
cur.execute("""
    SELECT id, username, phone, registered_by_id, sponsor_id, account_active,
           (SELECT COUNT(*) FROM business_promopurchase p WHERE p.user_id = u.id AND p.status IN ('approved', 'completed', 'APPROVED', 'COMPLETED')) as purchases
    FROM accounts_customuser u
    WHERE registered_by_id IN %s;
""", (tuple(excluded_ids),))
downlines = cur.fetchall()
print(f"\nUsers whose registered_by_id is an excluded test user: {len(downlines)}")
for d in downlines:
    print(dict(d))

# 3. Check all other active users in production
cur.execute("""
    SELECT COUNT(*) as total_active
    FROM accounts_customuser u
    WHERE (u.account_active = True 
       OR u.id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR u.id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount))
      AND u.id NOT IN %s;
""", (tuple(excluded_ids),))
clean_active_count = cur.fetchone()['total_active']
print(f"\nTotal Real Active Users to Import (excluding test series): {clean_active_count}")

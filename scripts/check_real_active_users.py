import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
conn = psycopg2.connect(prod_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

cur.execute("""
    SELECT COUNT(*) as total_real
    FROM accounts_customuser u
    WHERE (u.account_active = True 
       OR u.id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR u.id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount))
      AND u.username NOT LIKE '10100000%'
      AND u.phone NOT LIKE '10100000%'
      AND u.username NOT LIKE '80959181%'
      AND u.phone NOT LIKE '80959181%'
      AND u.username NOT LIKE '080959181%'
      AND u.phone NOT LIKE '080959181%'
      AND u.username NOT LIKE 'SIM%';
""")
real_cnt = cur.fetchone()['total_real']
print(f"Total REAL active users to import: {real_cnt}")

# Check sponsor links of all these real users
cur.execute("""
    SELECT u.id, u.username, u.phone, u.registered_by_id, u.sponsor_id,
           sp.username as sponsor_username, sp.phone as sponsor_phone
    FROM accounts_customuser u
    LEFT JOIN accounts_customuser sp ON u.registered_by_id = sp.id
    WHERE (u.account_active = True 
       OR u.id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR u.id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount))
      AND u.username NOT LIKE '10100000%'
      AND u.phone NOT LIKE '10100000%'
      AND u.username NOT LIKE '80959181%'
      AND u.phone NOT LIKE '80959181%'
      AND u.username NOT LIKE '080959181%'
      AND u.phone NOT LIKE '080959181%'
      AND u.username NOT LIKE 'SIM%'
    ORDER BY u.id
    LIMIT 20;
""")
sample = cur.fetchall()
for r in sample:
    print(dict(r))

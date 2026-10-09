import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
conn = psycopg2.connect(prod_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

excluded_ids = (2, 4, 6, 139, 625, 2253, 639, 150, 136, 122, 121, 124, 120, 125, 381, 103, 102, 104, 105, 101)

cur.execute("""
    SELECT id, username, phone, registered_by_id, sponsor_id
    FROM accounts_customuser
    WHERE id NOT IN %s 
      AND (account_active = True 
           OR id IN (SELECT DISTINCT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
           OR id IN (SELECT DISTINCT owner_id FROM business_autopoolaccount))
      AND registered_by_id IN %s;
""", (excluded_ids, excluded_ids))
res = cur.fetchall()
print('Clean active users whose registered_by_id points to an excluded user:', [dict(r) for r in res])

import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
conn = psycopg2.connect(prod_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. Sample of registered_by_id vs sponsor_id in Production ===")
cur.execute("""
    SELECT id, username, phone, registered_by_id, sponsor_id
    FROM accounts_customuser
    WHERE registered_by_id IS NOT NULL OR sponsor_id IS NOT NULL
    LIMIT 25;
""")
for r in cur.fetchall():
    print(dict(r))

print("\n=== 2. Check excluded users matching 1010000001-1010000011 or 80959181* ===")
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
print("Excluded users count: " + str(len(excluded)))
for r in excluded:
    print(dict(r))

print("\n=== 3. What happens to users whose sponsor is in the excluded set? ===")
excluded_ids = tuple(r['id'] for r in excluded)
if excluded_ids:
    cur.execute("""
        SELECT id, username, phone, registered_by_id, sponsor_id
        FROM accounts_customuser
        WHERE registered_by_id IN %s OR sponsor_id IN %s;
    """, (excluded_ids, excluded_ids))
    downlines_of_excluded = cur.fetchall()
    print("Downlines whose direct sponsor was one of the excluded users: " + str(len(downlines_of_excluded)))
    for r in downlines_of_excluded[:15]:
        print(dict(r))

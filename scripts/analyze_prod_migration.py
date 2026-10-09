import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print('=== 1. PRODUCTION OVERVIEW ===')
p_cur.execute('SELECT COUNT(*) as cnt FROM accounts_customuser;')
print('Total Prod Users: ' + str(p_cur.fetchone()['cnt']))

p_cur.execute('SELECT COUNT(*) as cnt FROM accounts_customuser WHERE account_active = True;')
print('Total Prod account_active=True: ' + str(p_cur.fetchone()['cnt']))

p_cur.execute('SELECT COUNT(*) as cnt FROM accounts_customuser WHERE is_active = True;')
print('Total Prod is_active=True: ' + str(p_cur.fetchone()['cnt']))

p_cur.execute('''
    SELECT COUNT(DISTINCT id) as cnt 
    FROM accounts_customuser 
    WHERE account_active = True 
       OR id IN (SELECT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED'))
       OR id IN (SELECT owner_id FROM business_autopoolaccount);
''')
print('Active/Purchased Candidates in Prod: ' + str(p_cur.fetchone()['cnt']))

print('\n=== 2. STAGING OVERVIEW ===')
s_cur.execute('SELECT COUNT(*) as cnt FROM accounts_customuser;')
print('Total Staging Users: ' + str(s_cur.fetchone()['cnt']))

s_cur.execute('SELECT id, username, phone FROM accounts_customuser ORDER BY id;')
print('Current Staging Users: ' + str([dict(r) for r in s_cur.fetchall()]))

print('\n=== 3. Schema Comparison for accounts_customuser ===')
p_cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'accounts_customuser' ORDER BY ordinal_position;")
p_cols = {r['column_name']: r for r in p_cur.fetchall()}

s_cur.execute("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'accounts_customuser' ORDER BY ordinal_position;")
s_cols = {r['column_name']: r for r in s_cur.fetchall()}

diff_in_p = set(p_cols.keys()) - set(s_cols.keys())
diff_in_s = set(s_cols.keys()) - set(p_cols.keys())
print('Columns in Prod but not Staging: ' + str(diff_in_p))
print('Columns in Staging but not Prod: ' + str(diff_in_s))

print('\n=== 4. Sponsor Relationship & Tree Integrity ===')
p_cur.execute('''
    SELECT COUNT(*) as cnt 
    FROM accounts_customuser 
    WHERE (account_active = True OR id IN (SELECT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED')))
      AND registered_by_id IS NOT NULL;
''')
print('Active users with a Sponsor: ' + str(p_cur.fetchone()['cnt']))

p_cur.execute('''
    SELECT COUNT(*) as cnt 
    FROM accounts_customuser 
    WHERE (account_active = True OR id IN (SELECT user_id FROM business_promopurchase WHERE status IN ('approved', 'completed', 'APPROVED', 'COMPLETED')))
      AND registered_by_id IS NULL;
''')
print('Active users without a Sponsor (Root/Admins/Agencies): ' + str(p_cur.fetchone()['cnt']))

import psycopg2

db_url = 'postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require'
conn = psycopg2.connect(db_url)
cur = conn.cursor()
cur.execute('SELECT count(*) FROM business_teamconsumerwishingbanner;')
print('BANNERS IN POSTGRES:', cur.fetchone()[0])
cur.execute('SELECT id, title, image, is_active FROM business_teamconsumerwishingbanner;')
for r in cur.fetchall():
    print(r)
cur.close()
conn.close()

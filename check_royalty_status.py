import psycopg2

DATABASE_URL = 'postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require'
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

# Find users sponsored by 9999999999
cur.execute("SELECT id, username, phone, full_name, date_joined FROM accounts_customuser WHERE registered_by_id = 1 OR sponsor_id = '9999999999' ORDER BY id ASC LIMIT 10;")
print("Downlines of 9999999999:")
for d in cur.fetchall():
    print(d)

# Check promo purchases
cur.execute("SELECT id, user_id, package_id, status, approved_at FROM business_promopurchase ORDER BY id DESC LIMIT 20;")
print("\nRecent Promo Purchases:")
for p in cur.fetchall():
    print(p)

# Check rank upgrades
cur.execute("SELECT id, user_id, from_rank_id, to_rank_id, net_amount, payment_status, upgraded_at FROM mlm_ranks_rankupgrade ORDER BY id DESC LIMIT 20;")
print("\nRecent Rank Upgrades:")
for r in cur.fetchall():
    print(r)

# Check any GLOBAL_ROYALTY transactions
cur.execute("SELECT id, user_id, amount, type, created_at, meta FROM accounts_wallettransaction WHERE type = 'GLOBAL_ROYALTY' ORDER BY id DESC LIMIT 20;")
print("\nGLOBAL_ROYALTY Transactions:")
for t in cur.fetchall():
    print(t)

conn.close()

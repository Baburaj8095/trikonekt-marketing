import psycopg2
import psycopg2.extras

DB_URL = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"

conn = psycopg2.connect(DB_URL)
cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
tables = [r[0] for r in cursor.fetchall()]

print("==========================================================")
print("AWS RDS PostgreSQL Tables & Non-Zero Record Counts:")
print("==========================================================")

for t in sorted(tables):
    try:
        cursor.execute(f"SELECT COUNT(*) FROM \"{t}\";")
        cnt = cursor.fetchone()[0]
        if cnt > 0:
            print(f"  {t}: {cnt} rows")
    except Exception as e:
        conn.rollback()

print("\n--- Sample Users in AWS RDS ---")
cursor.execute("SELECT id, username, mobile, date_joined FROM accounts_customuser ORDER BY id DESC LIMIT 15;")
for u in cursor.fetchall():
    print(dict(u))

print("\n--- Inspecting Wallet Upload Requests (All Statuses) ---")
try:
    cursor.execute("SELECT id, amount, status, utr, created_at, user_id FROM accounts_walletuploadrequest LIMIT 20;")
    for r in cursor.fetchall():
        print(dict(r))
except Exception as e:
    conn.rollback()
    print("No accounts_walletuploadrequest table or error:", e)

print("\n--- Inspecting Wallet Transactions / Ledger ---")
try:
    cursor.execute("SELECT id, amount, transaction_type, created_at, user_id FROM accounts_wallettransaction ORDER BY id DESC LIMIT 20;")
    for r in cursor.fetchall():
        print(dict(r))
except Exception as e:
    conn.rollback()
    print("No accounts_wallettransaction table or error:", e)

conn.close()

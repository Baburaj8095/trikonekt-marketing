import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import psycopg2, os
conn = psycopg2.connect(os.environ["DATABASE_URL"])
conn.autocommit = True
cur = conn.cursor()

admin_usernames = ("admin", "rayaru", "xavier", "leela")

# Find IDs in accounts_customuser
cur.execute("SELECT id FROM accounts_customuser WHERE username IN %s;", [admin_usernames])
admin_ids = [r[0] for r in cur.fetchall()]
print("Found admin IDs in accounts_customuser to remove:", admin_ids)

if admin_ids:
    admin_ids_tuple = tuple(admin_ids)
    # Clear FKs
    cur.execute("""
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'accounts_customuser';
    """)
    fks = cur.fetchall()
    for table_name, column_name in fks:
        if table_name not in ("accounts_admin_portal_user", "accounts_admin_totp"):
            try:
                cur.execute(f"DELETE FROM {table_name} WHERE {column_name} IN %s;", [admin_ids_tuple])
            except Exception:
                try:
                    cur.execute(f"UPDATE {table_name} SET {column_name} = NULL WHERE {column_name} IN %s;", [admin_ids_tuple])
                except Exception:
                    pass

    cur.execute("DELETE FROM accounts_customuser WHERE id IN %s;", [admin_ids_tuple])
    print(f"Purged admin accounts {admin_usernames} from accounts_customuser completely.")

cur.execute("SELECT COUNT(*) FROM accounts_customuser WHERE category = 'consumer';")
print("Verified Community Consumers total:", cur.fetchone()[0])

cur.execute("SELECT COUNT(*) FROM accounts_customuser WHERE account_active = TRUE;")
print("Verified Active Community Consumers count:", cur.fetchone()[0])
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/purge_admins_from_customuser.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/purge_admins_from_customuser.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

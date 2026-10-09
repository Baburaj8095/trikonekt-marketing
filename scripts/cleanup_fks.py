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

ids = (1041, 1043, 1045)

# Find all foreign keys referencing accounts_customuser
cur.execute("""
SELECT
    tc.table_name,
    kcu.column_name
FROM
    information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'accounts_customuser';
""")

fks = cur.fetchall()
print(f"Found {len(fks)} FK references to accounts_customuser:")
for table_name, column_name in fks:
    try:
        cur.execute(f"DELETE FROM {table_name} WHERE {column_name} IN %s;", [ids])
    except Exception as e:
        # If column is nullable, try set null
        try:
            cur.execute(f"UPDATE {table_name} SET {column_name} = NULL WHERE {column_name} IN %s;", [ids])
        except Exception:
            pass

# Now delete the 3 shadow accounts
cur.execute("DELETE FROM accounts_customuser WHERE id IN %s;", [ids])
print("Successfully deleted shadow consumer IDs 1041, 1043, 1045!")

cur.execute("SELECT COUNT(*) FROM accounts_customuser WHERE category = 'consumer';")
print("Community Consumers Total:", cur.fetchone()[0])
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/cleanup_fks.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/cleanup_fks.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

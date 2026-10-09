import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
import psycopg2, psycopg2.extras, json

staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"
conn = psycopg2.connect(staging_url)
conn.autocommit = True
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# 1. Create 2FA table if not exists
cur.execute("""
CREATE TABLE IF NOT EXISTS accounts_admin_totp (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES accounts_customuser(id) ON DELETE CASCADE,
    secret_key VARCHAR(64) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    backup_codes JSONB DEFAULT '[]'::jsonb,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    last_used_timestep BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
""")
print("accounts_admin_totp table ensured.")

# 2. Check current admin/staff users in staging
cur.execute("""
SELECT id, username, phone, full_name, role, is_staff, is_superuser, is_active
FROM accounts_customuser
WHERE is_staff = TRUE OR is_superuser = TRUE OR role = 'admin' OR username IN ('admin', '9999999999', '8095918105');
""")
admins = cur.fetchall()
print(f"Found {len(admins)} admin/staff users:")
for a in admins:
    print(dict(a))
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/setup_2fa_db.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/setup_2fa_db.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

import subprocess
import os

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_script = """
python3 - << 'EOF'
import psycopg2
import psycopg2.extras

prod_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt?sslmode=require"
staging_url = "postgres://trikonekt_admin:Baburajnk19@trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com:5432/trikonekt_staging?sslmode=require"

p_conn = psycopg2.connect(prod_url)
p_cur = p_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

s_conn = psycopg2.connect(staging_url)
s_cur = s_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

p_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active, date_joined FROM accounts_customuser ORDER BY id;")
prod_users = {r["id"]: r for r in p_cur.fetchall()}

s_cur.execute("SELECT id, username, phone, full_name, role, category, is_active, account_active, date_joined FROM accounts_customuser ORDER BY id;")
staging_users = {r["id"]: r for r in s_cur.fetchall()}

print("==================================================================================")
print("                   PRODUCTION VS STAGING USER COMPARISON REPORT                   ")
print("==================================================================================")
print(f"Total Users in PRODUCTION Database : {len(prod_users)}")
print(f"Total Users in STAGING Database    : {len(staging_users)}")
print("----------------------------------------------------------------------------------")

prod_ids = set(prod_users.keys())
staging_ids = set(staging_users.keys())

deleted_in_staging = sorted(list(prod_ids - staging_ids))
added_in_staging = sorted(list(staging_ids - prod_ids))

print(f"Total User IDs in PROD but DELETED/MISSING in STAGING : {len(deleted_in_staging)}")
print(f"Total User IDs in STAGING but not in PROD (New/Added) : {len(added_in_staging)}")
print("==================================================================================")

if deleted_in_staging:
    print(f"\n--- LIST OF ALL {len(deleted_in_staging)} DELETED/MISSING USER IDs IN STAGING ---")
    print(f"Deleted IDs List: {deleted_in_staging}\n")
    for uid in deleted_in_staging:
        u = prod_users[uid]
        name = str(u['full_name'] or '—')
        phone = str(u['phone'] or '—')
        username = str(u['username'] or '—')
        role = str(u['role'] or '—')
        category = str(u['category'] or '—')
        act = "Active" if u['account_active'] else "Inactive"
        print(f"ID #{u['id']:<4} | Phone: {phone:<12} | Username: {username:<15} | Name: {name:<25} | Role: {role:<8} | Category: {category:<12} | Status: {act}")

if added_in_staging:
    print(f"\n--- LIST OF ALL {len(added_in_staging)} NEW/ADDED USER IDs IN STAGING ---")
    print(f"Added IDs List: {added_in_staging}\n")
    for uid in added_in_staging:
        u = staging_users[uid]
        name = str(u['full_name'] or '—')
        phone = str(u['phone'] or '—')
        username = str(u['username'] or '—')
        role = str(u['role'] or '—')
        category = str(u['category'] or '—')
        act = "Active" if u['account_active'] else "Inactive"
        print(f"ID #{u['id']:<4} | Phone: {phone:<12} | Username: {username:<15} | Name: {name:<25} | Role: {role:<8} | Category: {category:<12} | Status: {act}")

print("\n==================================================================================")
EOF
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_script
]
subprocess.run(ssh_cmd, check=True)

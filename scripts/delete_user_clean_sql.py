import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_py_code = """
from django.db import connection

with connection.cursor() as cur:
    cur.execute("SELECT id FROM accounts_customuser WHERE username='8095918105' OR phone='8095918105';")
    row = cur.fetchone()
    if not row:
        print('USER 8095918105 ALREADY DELETED OR NOT FOUND IN DB!')
    else:
        uid = row[0]
        print(f'Deleting user ID {uid} and all related foreign key records...')
        
        # 1. Nullify circular user references first
        cur.execute("UPDATE accounts_customuser SET registered_by_id = NULL WHERE registered_by_id = %s;", [uid])
        cur.execute("UPDATE accounts_customuser SET parent_id = NULL WHERE parent_id = %s;", [uid])
        cur.execute("UPDATE business_autopoolaccount SET parent_account_id = NULL WHERE parent_account_id IN (SELECT id FROM business_autopoolaccount WHERE owner_id = %s);", [uid])
        cur.execute("UPDATE accounts_walletuploadrequest SET wallet_transaction_id = NULL WHERE user_id = %s;", [uid])

        # 2. Query Postgres information schema to find ALL foreign keys pointing to accounts_customuser
        cur.execute(\"\"\"
            SELECT kcu.table_name, kcu.column_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
              ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = 'accounts_customuser'
              AND ccu.column_name = 'id';
        \"\"\")
        fks = cur.fetchall()
        print(f'Found {len(fks)} foreign key constraints referencing accounts_customuser.')

        # Delete dependent rows for each table
        for table_name, column_name in fks:
            if table_name == 'accounts_customuser':
                continue
            try:
                cur.execute(f"DELETE FROM {table_name} WHERE {column_name} = %s;", [uid])
            except Exception as e:
                try:
                    cur.execute(f"UPDATE {table_name} SET {column_name} = NULL WHERE {column_name} = %s;", [uid])
                except Exception as e2:
                    print(f'Skipped {table_name}.{column_name}: {e2}')

        # 3. Final deletion of user from accounts_customuser
        cur.execute("DELETE FROM accounts_customuser WHERE id = %s;", [uid])
        print(f'=== USER ID {uid} (8095918105) SUCCESSFULLY AND COMPLETELY DELETED FROM DATABASE! ===')
"""

# Write remote python file
ssh_cmd1 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"cat << 'EOF' > /tmp/clean_user_sql.py\n{remote_py_code}\nEOF"
]
subprocess.run(ssh_cmd1)

# Run python script inside manage.py shell
remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/clean_user_sql.py'"

ssh_cmd2 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_cmd
]

res = subprocess.run(ssh_cmd2, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

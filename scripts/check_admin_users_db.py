import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('65.0.40.184', username='ubuntu', key_filename=r'C:\Users\babur\Downloads\TRI_MARKETING.pem')

remote_script = '''
import psycopg2

conn = psycopg2.connect(dbname='trikonekt_staging', user='postgres', password='', host='localhost')
cur = conn.cursor()
cur.execute('SELECT id, username, email, full_name, role, is_superuser, is_active FROM accounts_admin_portal_user ORDER BY id;')
rows = cur.fetchall()
print("ADMIN USERS IN accounts_admin_portal_user:")
for r in rows:
    print(r)

# Check accounts_admin_totp
cur.execute('SELECT username, is_enabled, created_at FROM accounts_admin_totp;')
totp_rows = cur.fetchall()
print("\nTOTP STATUS:")
for t in totp_rows:
    print(t)
'''

sftp = ssh.open_sftp()
with sftp.file('/tmp/check_admin_users.py', 'w') as f:
    f.write(remote_script)

stdin, stdout, stderr = ssh.exec_command('/srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_admin_users.py')
print(stdout.read().decode())
print(stderr.read().decode())

ssh.close()

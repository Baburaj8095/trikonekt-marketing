import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
from django.db import connection

with connection.cursor() as cur:
    cur.execute('''
        SELECT tgname, tgrelid::regclass
        FROM pg_trigger
        WHERE tgrelid IN ('accounts_financialtransaction'::regclass, 'accounts_wallettransaction'::regclass, 'accounts_customuser'::regclass);
    ''')
    for row in cur.fetchall():
        print(row)
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\tmp_inspect_trig.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/tmp_inspect_trig.py"
], check=True)

remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/tmp_inspect_trig.py'"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

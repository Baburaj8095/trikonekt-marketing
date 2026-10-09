import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"

py_code = """from django.db import connection

with connection.cursor() as cur:
    cur.execute('''
        SELECT tgname, tgrelid::regclass, proname, prosrc
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE tgrelid::regclass::text LIKE 'accounts_%' OR tgrelid::regclass::text LIKE 'coupons_%';
    ''')
    for row in cur.fetchall():
        print(f"Trigger: {row[0]} on Table: {row[1]}, Func: {row[2]}")
        print("  Code snippet:", row[3][:200].replace('\\n', ' '))
"""

local_tmp_path = "scripts/tmp_inspect_trig.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, "ubuntu@65.0.40.184:/tmp/tmp_inspect_trig.py"
], check=True)

remote_cmd = "sudo /srv/trikonekt/staging/backend/.venv/bin/python -c \"import sys, os; sys.path.insert(0, '/srv/trikonekt/staging/backend'); import core.settings; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings'); exec(open('/tmp/tmp_inspect_trig.py').read())\""
res = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

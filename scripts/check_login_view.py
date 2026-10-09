import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")

import django
django.setup()

from django.urls import resolve
try:
    match = resolve("/api/admin/login/")
    print("/api/admin/login/ maps to:", match.func, "in module:", match.func.__module__)
except Exception as e:
    print("Could not resolve /api/admin/login/:", e)

try:
    match2 = resolve("/admin/login/")
    print("/admin/login/ maps to:", match2.func, "in module:", match2.func.__module__)
except Exception as e:
    print("Could not resolve /admin/login/:", e)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/check_login_view.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_login_view.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

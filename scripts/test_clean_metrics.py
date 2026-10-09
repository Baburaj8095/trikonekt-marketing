import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_test = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import os, sys, urllib.request, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")
import django
django.setup()

from adminapi.views_totp_2fa import make_admin_jwt_tokens
access, _ = make_admin_jwt_tokens({"id": 1, "username": "admin", "full_name": "Trikonekt SuperAdmin", "is_superuser": True})

metrics_req = urllib.request.Request("http://127.0.0.1:8001/api/admin/metrics/?refresh=1")
metrics_req.add_header("Authorization", f"Bearer {access}")
with urllib.request.urlopen(metrics_req) as resp:
    data = json.loads(resp.read().decode())
    print("Clean Live Metrics Users Block:", data.get("users"))
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_clean_metrics.py\n{remote_test}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_clean_metrics.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

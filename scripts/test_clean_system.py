import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_test = '''
import urllib.request, json

admins = ["admin", "rayaru", "xavier", "leela"]
for a in admins:
    req = urllib.request.Request(
        "http://127.0.0.1:8001/api/admin/login/",
        data=json.dumps({"username": a, "password": "Tri@2026"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"Login for '{a}': require_2fa_setup={data.get('require_2fa_setup')}, username={data.get('username')}, has_qr={bool(data.get('qr_code'))}")

# Also test /api/admin/metrics/
token_req = urllib.request.Request(
    "http://127.0.0.1:8001/api/admin/login/",
    data=json.dumps({"username": "admin", "password": "Tri@2026"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
# We can test metrics endpoint without cache
metrics_req = urllib.request.Request("http://127.0.0.1:8001/api/admin/metrics/?refresh=1")
# For testing metrics, import make_admin_jwt_tokens
from adminapi.views_totp_2fa import make_admin_jwt_tokens
access, _ = make_admin_jwt_tokens({"id": 1, "username": "admin", "full_name": "Trikonekt SuperAdmin", "is_superuser": True})
metrics_req.add_header("Authorization", f"Bearer {access}")
with urllib.request.urlopen(metrics_req) as resp:
    data = json.loads(resp.read().decode())
    print("Clean Live Metrics Users Block:", data.get("users"))
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_clean_system.py\n{remote_code if False else remote_test}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_clean_system.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

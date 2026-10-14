import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import time, requests, os, sys
env_file = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import CustomUser

user = CustomUser.objects.filter(phone='9999999999').first()
refresh = RefreshToken.for_user(user)
token = str(refresh.access_token)

auth_headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/accounts/team/summary/",
    "/api/accounts/wallet/me/",
    "/api/accounts/genealogy/5m/counts/?pool=FIVE_150&depth=10",
    "/api/ranks/",
    "/api/user/upgrade-eligibility/",
    "/api/accounts/wallet/me/history/",
    "/api/rank-matrix/tree-bfs/?max_depth=2",
]

print("Benchmarking Django Staging API endpoints (port 8001):")
for ep in endpoints:
    t0 = time.time()
    res = requests.get(f"http://127.0.0.1:8001{ep}", headers=auth_headers)
    print(f"{ep} -> {res.status_code} in {(time.time()-t0)*1000:.1f}ms")
"""

proc = subprocess.run(
    ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"{ec2_user}@{ec2_ip}", "/srv/trikonekt/staging/backend/.venv/bin/python"],
    input=remote_code,
    text=True,
    capture_output=True
)
print("STDOUT:\n", proc.stdout)
print("STDERR:\n", proc.stderr)

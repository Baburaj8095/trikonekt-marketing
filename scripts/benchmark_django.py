import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import time, os, sys
t0 = time.time()
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
t1 = time.time()
from accounts.models import CustomUser
u = CustomUser.objects.filter(phone='9999999999').first()
t2 = time.time()
print(f"Django setup took: {t1-t0:.4f}s")
print(f"DB Query took: {t2-t1:.4f}s")
print(f"Total time: {t2-t0:.4f}s")
"""

proc = subprocess.run(
    ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"{ec2_user}@{ec2_ip}", "/srv/trikonekt/staging/backend/.venv/bin/python"],
    input=remote_code,
    text=True,
    capture_output=True
)
print("STDOUT:\n", proc.stdout)
print("STDERR:\n", proc.stderr)

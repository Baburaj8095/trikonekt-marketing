import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import time, os, sys
env_file = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_file):
    with open(env_file, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

sys.path.insert(0, '/srv/trikonekt/staging/backend')
sys.path.insert(0, '/srv/trikonekt/tri-academy/backend/src/scripts')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

import growth_bridge_exec

# Test running user_overview 5 times sequentially inside the same process
print("Testing warm execution inside persistent process:")
for i in range(5):
    t0 = time.time()
    res = growth_bridge_exec.get_user_overview('9999999999')
    t1 = time.time()
    print(f"Call {i+1} time: {(t1-t0)*1000:.2f} ms")
"""

proc = subprocess.run(
    ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"{ec2_user}@{ec2_ip}", "/srv/trikonekt/staging/backend/.venv/bin/python"],
    input=remote_code,
    text=True,
    capture_output=True
)
print("STDOUT:\n", proc.stdout)
print("STDERR:\n", proc.stderr)

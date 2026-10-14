import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """import os, sys, django
env_file = '/etc/trikonekt/staging-backend.env'
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import WalletTransaction
for tx in WalletTransaction.objects.all().order_by('-id')[:5]:
    print(f"id={tx.id}, user={tx.user.username}, amount={tx.amount}, type={tx.type}, source_type={tx.source_type}, source_id={tx.source_id}, meta={tx.meta}")
"""

proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"/srv/trikonekt/staging/backend/.venv/bin/python -c \"{remote_code}\""
], capture_output=True, text=True, encoding="utf-8")

print("STDOUT:\n", proc.stdout)

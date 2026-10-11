import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

py_script = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from accounts.models import CustomUser, Wallet
agencies = CustomUser.objects.filter(role='agency').order_by('id')
print(f'Total agency users count: {agencies.count()}')
for a in agencies:
    w = Wallet.objects.filter(user=a).first()
    fte = getattr(w, 'franchise_total_earning', 0) if w else 0
    faw = getattr(w, 'franchise_active_work', 0) if w else 0
    mb = getattr(w, 'main_balance', 0) if w else 0
    print(f'Agency ID: {a.id}, username: {a.username}, phone: {a.phone}, main_bal: {mb}, franchise_total: {fte}, franchise_active: {faw}, active: {a.account_active}')
"""

scp_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    f"cat << 'EOF' > /tmp/check_agencies.py\n{py_script}\nEOF"
]
subprocess.run(scp_cmd, check=True)

exec_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    "sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_agencies.py'"
]
res = subprocess.run(exec_cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

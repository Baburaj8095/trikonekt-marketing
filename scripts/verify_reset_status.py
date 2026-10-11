import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = r"""import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase

print("=== VERIFYING RESET STATUS ===")
for phone in ['9999999999', '8095918105']:
    u = CustomUser.objects.filter(phone=phone).first() or CustomUser.objects.filter(username=phone).first()
    w = Wallet.objects.filter(user=u).first()
    ap_count = AutoPoolAccount.objects.filter(owner=u).count()
    tx_count = WalletTransaction.objects.filter(user=u).count()
    promo_count = PromoPurchase.objects.filter(user=u).count()
    sponsor_phone = u.registered_by.phone if u.registered_by else 'None'
    print(f"User {phone}: ID={u.id}, active={u.account_active}, sponsor={sponsor_phone}")
    print(f"  Wallet: main={w.main_balance if w else 0}, self_pocket={getattr(w, 'self_account_balance', 0) if w else 0}")
    print(f"  Counts: autopool={ap_count}, transactions={tx_count}, promo_purchases={promo_count}")

print("\n=== TOTAL REMAINING AUTOPOOL ACCOUNTS ===")
for ap in AutoPoolAccount.objects.all():
    print(f"#{ap.id} | {ap.pool_type} | owner={ap.owner.phone if ap.owner else None} | parent=#{ap.parent_account_id}")
"""

local_tmp = r"C:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\_tmp_inspect.py"
with open(local_tmp, "w", encoding="utf-8") as f:
    f.write(remote_code)

scp_cmd = [
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    local_tmp, f"ubuntu@{ec2_ip}:/tmp/verify_reset.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    "sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /tmp/verify_reset.py'"
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

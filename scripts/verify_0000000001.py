import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade, UpgradeCommission

u = CustomUser.objects.filter(username='0000000001').first() or CustomUser.objects.filter(phone='0000000001').first()
if not u:
    print("User 0000000001 not found.")
else:
    print(f"USER: ID={u.id}, username={u.username}, phone={u.phone}, active={u.account_active}")
    print(f"PromoPurchase: {PromoPurchase.objects.filter(user=u).count()}")
    print(f"PromoMonthlyBox: {PromoMonthlyBox.objects.filter(user=u).count()}")
    print(f"AutoPoolAccount: {AutoPoolAccount.objects.filter(owner=u).count()}")
    print(f"RankUpgrade: {RankUpgrade.objects.filter(user=u).count()}")
    print(f"UpgradeCommission (to or from): {UpgradeCommission.objects.filter(to_user=u).count() + UpgradeCommission.objects.filter(from_user=u).count()}")
    print(f"WalletTransaction (direct): {WalletTransaction.objects.filter(user=u).count()}")
    print(f"WalletTransaction (from as sponsor): {WalletTransaction.objects.filter(meta__from_user_id=u.id).count()}")
    w = Wallet.objects.filter(user=u).first()
    if w:
        print(f"Wallet: balance={w.balance}, main={w.main_balance}, withdrawable={w.withdrawable_balance}, self={getattr(w, 'self_account_balance', 0)}")
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\tmp_verify_0000000001.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/tmp_verify_0000000001.py"
], check=True)

remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/tmp_verify_0000000001.py'"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

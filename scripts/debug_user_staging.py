import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_py_code = """
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.services.prime import distribute_prime_750_payouts

u = CustomUser.objects.filter(username='8095918105').first()
sp = u.registered_by if u else None

print('=== BEFORE RETRIGGER DISTRIBUTE PRIME 750 PAYOUTS ===')
if sp:
    w = Wallet.objects.filter(user=sp).first()
    print('Sponsor Main Bal:', w.main_balance, 'Self Bal:', w.self_account_balance)

print('\\nInvoking distribute_prime_750_payouts(u, source={"type": "PROMO_PURCHASE_APPROVAL", "id": 5})...')
distribute_prime_750_payouts(u, source={"type": "PROMO_PURCHASE_APPROVAL", "id": 5})

print('\\n=== AFTER RETRIGGER ===')
if sp:
    w = Wallet.objects.filter(user=sp).first()
    print('Sponsor Main Bal:', w.main_balance, 'Self Bal:', w.self_account_balance)
    print('Sponsor Recent Wallet TXs:')
    for wt in WalletTransaction.objects.filter(user=sp).order_by('-id')[:8]:
        print('  TX ID:', wt.id, 'Type:', wt.type, 'Amount:', wt.amount, 'SourceType:', wt.source_type, 'SourceID:', wt.source_id, 'Meta:', wt.meta)
"""

# Write remote python file
ssh_cmd1 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"cat << 'EOF' > /tmp/test_p750.py\n{remote_py_code}\nEOF"
]
subprocess.run(ssh_cmd1)

# Run python script inside manage.py shell
remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/test_p750.py'"

ssh_cmd2 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_cmd
]

res = subprocess.run(ssh_cmd2, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

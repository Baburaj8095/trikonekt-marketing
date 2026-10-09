#!/usr/bin/env python3
import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from accounts.models import CustomUser, Wallet, WalletTransaction

u80 = CustomUser.objects.filter(username='8095918105').first()
u99 = CustomUser.objects.filter(username='9999999999').first()

print('=== 8095918105 ===')
print('ID:', u80.id, 'Sponsor:', u80.registered_by.username if u80.registered_by else None)
print('account_active:', u80.account_active)
w80 = Wallet.objects.filter(user=u80).first()
if w80:
    print('Wallet 80 balance:', w80.balance, 'main:', getattr(w80, 'main_balance', None), 'self:', getattr(w80, 'self_account_balance', None))
txs80 = list(WalletTransaction.objects.filter(user=u80).values('id', 'type', 'amount', 'source_type', 'source_id', 'created_at'))
print('Transactions 80:', txs80)

print('\\n=== 9999999999 ===')
print('ID:', u99.id, 'Sponsor:', u99.registered_by.username if u99.registered_by else None)
print('account_active:', u99.account_active)
w99 = Wallet.objects.filter(user=u99).first()
if w99:
    print('Wallet 99 balance:', w99.balance, 'main:', getattr(w99, 'main_balance', None), 'self:', getattr(w99, 'self_account_balance', None))
txs99 = list(WalletTransaction.objects.filter(user=u99).values('id', 'type', 'amount', 'source_type', 'source_id', 'created_at'))
print('Transactions 99:', txs99)

txs_from_80 = list(WalletTransaction.objects.filter(meta__from_user_id=u80.id).values('id', 'user__username', 'type', 'amount', 'created_at'))
print('\\nTransactions where from_user_id=8095918105:', txs_from_80)
"""

cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"sudo env $(sudo cat /etc/trikonekt/staging-backend.env | xargs) /srv/trikonekt/staging/backend/.venv/bin/python -c \"{remote_code}\""
]

res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)

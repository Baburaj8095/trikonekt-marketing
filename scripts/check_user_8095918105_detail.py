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
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade

u = CustomUser.objects.filter(username='8095918105').first()
if u:
    print(f'User: {u.username} (ID: {u.id})')
    print('account_active:', u.account_active)
    print('is_active:', u.is_active)
    print('PromoPurchases:', list(PromoPurchase.objects.filter(user=u).values('id', 'package__code', 'status', 'approved_at', 'requested_at')))
    print('AutoPoolAccounts:', list(AutoPoolAccount.objects.filter(owner=u).values('id', 'pool_type', 'layer', 'created_at')))
    print('PromoMonthlyBoxes:', list(PromoMonthlyBox.objects.filter(user=u).values('id', 'month_index', 'status')))
    print('RankUpgrades:', list(RankUpgrade.objects.filter(user=u).values('id', 'to_rank_id', 'payment_status')))
    print('WalletTransactions count:', WalletTransaction.objects.filter(user=u).count())
    w = Wallet.objects.filter(user=u).first()
    if w:
        print('Wallet:', w.balance, 'main:', getattr(w, 'main_balance', None), 'self:', getattr(w, 'self_account_balance', None))
else:
    print('User not found!')
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
if res.stderr:
    print("ERR:", res.stderr)

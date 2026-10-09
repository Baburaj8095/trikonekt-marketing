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

from accounts.models import CustomUser
from business.models import PromoPurchase

for phone in ['9999999999', '8095918105', '0000000001']:
    u = CustomUser.objects.filter(username=phone).first()
    if u:
        purchases = list(PromoPurchase.objects.filter(user=u).values('id', 'package__code', 'status', 'approved_at'))
        print(f'User: {phone} (ID: {u.id}, Name: {u.full_name})')
        print('  account_active:', u.account_active)
        print('  Purchases:', purchases)
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

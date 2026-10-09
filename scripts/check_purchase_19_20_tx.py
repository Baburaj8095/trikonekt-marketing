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

from accounts.models import WalletTransaction
for tx in WalletTransaction.objects.filter(source_id__in=['19', '20']):
    print('TX:', tx.id, tx.user.username, tx.type, tx.amount, tx.source_type, tx.source_id, tx.meta)

from coupons.models import AuditTrail
for a in AuditTrail.objects.filter(metadata__contains={'source_id': '19'}):
    print('Audit 19:', a.action, a.notes, a.metadata)
for a in AuditTrail.objects.filter(metadata__contains={'source_id': '20'}):
    print('Audit 20:', a.action, a.notes, a.metadata)
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

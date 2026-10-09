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

for phone in ['8095918105', '9999999999', '0000000001']:
    u = CustomUser.objects.filter(username=phone).first()
    if u:
        print(f'=== User {phone} ===')
        print('id:', u.id, 'name:', u.full_name)
        print('account_active:', u.account_active)
        print('is_active:', u.is_active)
        print('is_qualified:', getattr(u, 'is_qualified', None))
        print('is_prime:', getattr(u, 'is_prime', None))
    else:
        print(f'User {phone} not found!')
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

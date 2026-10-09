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

u80 = CustomUser.objects.filter(username='8095918105').first()
print('8095918105 registered_by:', u80.registered_by_id, u80.registered_by.username if u80.registered_by else None)
print('8095918105 sponsor_id:', getattr(u80, 'sponsor_id', None))

u99 = CustomUser.objects.filter(username='9999999999').first()
print('9999999999 ID:', u99.id, 'username:', u99.username)

u01 = CustomUser.objects.filter(username='0000000001').first()
if u01:
    print('0000000001 registered_by:', u01.registered_by_id, u01.registered_by.username if u01.registered_by else None)
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

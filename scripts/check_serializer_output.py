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
from adminapi.serializers import AdminUserNodeSerializer

qs = CustomUser.objects.filter(username__in=['8095918105', '9999999999', '0000000001']).order_by('id')
for u in qs:
    ser = AdminUserNodeSerializer(u)
    print(f'User {u.username}:')
    print('  DB account_active:', u.account_active)
    print('  Serializer account_active:', ser.data.get('account_active'))
    print('  Serializer is_active:', ser.data.get('is_active'))
    print('  Serializer join_prime_750:', ser.data.get('join_prime_750'))
    print('  Serializer spp_months_boxes:', ser.data.get('spp_months_boxes'))
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

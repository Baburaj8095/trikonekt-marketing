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

from business.models import CommissionConfig
cfg = CommissionConfig.get_solo()
m = cfg.master_commission_json or {}
print('=== Master Commission JSON Highlights ===')
print('Tax:', m.get('tax'))
print('Custom Module Tax:', m.get('custom_module_tax'))
print('SPP 1000 Config:', m.get('spp_1000_config'))
print('Direct Bonus 750:', (m.get('direct_bonus') or {}).get('750'))
print('Direct Bonus 1000:', (m.get('direct_bonus') or {}).get('1000'))
print('Direct Bonus 759:', (m.get('direct_bonus') or {}).get('759'))
print('Consumer Matrix 5 (750):', (m.get('consumer_matrix_5') or {}).get('750'))
print('Consumer Matrix 3 (750):', (m.get('consumer_matrix_3') or {}).get('750'))
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

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

import subprocess
cmd = "grep -rn --exclude-dir='.venv' --exclude-dir='__pycache__' 'geo_fixed' /srv/trikonekt/staging/backend/"
out = subprocess.getoutput(cmd)
print('grep geo_fixed:')
print(out)

cmd2 = "grep -rn --exclude-dir='.venv' --exclude-dir='__pycache__' 'FRANCHISE' /srv/trikonekt/staging/backend/"
out2 = subprocess.getoutput(cmd2)
print('grep FRANCHISE:')
print(out2[:2000])
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

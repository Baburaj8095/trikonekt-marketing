import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os, sys, django, json
env_file = '/etc/trikonekt/staging-backend.env'
if os.path.exists(env_file):
    with open(env_file) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from business.models import CommissionConfig
from business.services.self_rebirth import get_rebirth_config

cfg = CommissionConfig.get_solo()
master = dict(getattr(cfg, 'master_commission_json', {}) or {})
ruc = dict(master.get('rank_upgrade_config', {}) or {})

print("FRANCHISE REBIRTH ALLOCATION IN DB:")
print(json.dumps(ruc.get('franchise_rebirth_allocation', {}), indent=2))
print("CONSUMER REBIRTH ALLOCATION IN DB:")
print(json.dumps(ruc.get('consumer_rebirth_allocation', {}), indent=2))
"""

proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python"
], input=remote_code, capture_output=True, text=True)

print("STDOUT:\n", proc.stdout)
if proc.stderr:
    print("STDERR:\n", proc.stderr)

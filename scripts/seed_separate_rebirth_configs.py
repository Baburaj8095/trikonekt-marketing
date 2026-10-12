import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os, sys, django, json, copy

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
cfg = CommissionConfig.get_solo()
master = dict(getattr(cfg, 'master_commission_json', {}) or {})
ruc = dict(master.get('rank_upgrade_config', {}) or {})
base_rebirth = copy.deepcopy(ruc.get('rebirth_allocation', {}))

if 'consumer_rebirth_allocation' not in ruc or not ruc['consumer_rebirth_allocation']:
    ruc['consumer_rebirth_allocation'] = copy.deepcopy(base_rebirth)
if 'franchise_rebirth_allocation' not in ruc or not ruc['franchise_rebirth_allocation']:
    ruc['franchise_rebirth_allocation'] = copy.deepcopy(base_rebirth)

master['rank_upgrade_config'] = ruc
cfg.master_commission_json = master
cfg.save(update_fields=['master_commission_json'])

print("Successfully updated CommissionConfig with separate consumer_rebirth_allocation and franchise_rebirth_allocation!")
print("Updated keys in rank_upgrade_config:", list(ruc.keys()))
print("rebirth_allocation direct_sponsor:", (ruc.get('rebirth_allocation') or {}).get('direct_sponsor'))
print("consumer_rebirth_allocation direct_sponsor:", (ruc.get('consumer_rebirth_allocation') or {}).get('direct_sponsor'))
print("franchise_rebirth_allocation direct_sponsor:", (ruc.get('franchise_rebirth_allocation') or {}).get('direct_sponsor'))
"""

proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"/srv/trikonekt/staging/backend/.venv/bin/python"
], input=remote_code, capture_output=True, text=True)

print("EC2 STDOUT:\n", proc.stdout)
if proc.stderr:
    print("EC2 STDERR:\n", proc.stderr)

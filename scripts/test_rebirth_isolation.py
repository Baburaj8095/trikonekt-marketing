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
from business.services.self_rebirth import get_rebirth_config
from business.models import CommissionConfig

cfg = CommissionConfig.get_solo()
master = dict(getattr(cfg, 'master_commission_json', {}) or {})
ruc = dict(master.get('rank_upgrade_config', {}) or {})

# Set franchise direct sponsor to 55 for testing
ruc['franchise_rebirth_allocation']['direct_sponsor'] = 55
cfg.master_commission_json = master
cfg.save(update_fields=['master_commission_json'])

c_cfg = get_rebirth_config(is_franchise=False)
f_cfg = get_rebirth_config(is_franchise=True)
print("AFTER FRANCHISE UPDATE:")
print("Consumer config - Direct sponsor:", c_cfg.get('direct_sponsor'))
print("Franchise config - Direct sponsor:", f_cfg.get('direct_sponsor'))
assert c_cfg.get('direct_sponsor') == 40, "Consumer config must remain 40!"
assert f_cfg.get('direct_sponsor') == 55, "Franchise config must be 55!"
print("ISOLATION TEST PASSED: Changing franchise rebirth does NOT affect consumer rebirth!")

# Restore franchise direct sponsor back to 40
ruc['franchise_rebirth_allocation']['direct_sponsor'] = 40
cfg.master_commission_json = master
cfg.save(update_fields=['master_commission_json'])
print("Restored cleanly to 40.")
"""

proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python"
], input=remote_code, capture_output=True, text=True)

print("STDOUT:\n", proc.stdout)

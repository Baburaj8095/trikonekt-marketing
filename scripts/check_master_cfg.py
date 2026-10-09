import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_code = '''
import json
from business.models import CommissionConfig

cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}
print("=== COMMISSION CONFIG MASTER ===")
print("geo_fixed:", json.dumps(master.get('geo_fixed', {}), indent=2))
print("geo_mode:", json.dumps(master.get('geo_mode', {}), indent=2))
print("direct_bonus:", json.dumps(master.get('direct_bonus', {}), indent=2))
'''

with open("scripts/tmp_check_master_cfg.py", "w") as f:
    f.write(remote_code)

subprocess.run(["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_check_master_cfg.py", "ubuntu@65.0.40.184:/tmp/tmp_check_master_cfg.py"], check=True)
cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "cd /srv/trikonekt/staging/backend && set -a && . /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python manage.py shell < /tmp/tmp_check_master_cfg.py"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_script_code = r"""import os, sys, json, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from business.models import CommissionConfig, AutoPoolAccount, PromoPurchase
from accounts.models import CustomUser

print("=== CHECKING AutoPoolAccount in STAGING DB ===")
for acc in AutoPoolAccount.objects.order_by('id'):
    owner_phone = acc.owner.phone if acc.owner else 'None'
    parent_id = acc.parent_account_id
    parent_owner = acc.parent_account.owner.phone if acc.parent_account and acc.parent_account.owner else 'None'
    print(f"ID: #{acc.id} | Owner: {owner_phone} | Pool: {acc.pool_type} | EntryIdx: {acc.user_entry_index} | Pos: {acc.position} | Level: {acc.level} | Parent: #{parent_id} ({parent_owner}) | SrcType: {acc.source_type} | SrcID: {acc.source_id} | Created: {acc.created_at}")

print()
print("=== PROMO PURCHASES in STAGING DB ===")
for p in PromoPurchase.objects.order_by('id'):
    print(f"ID: #{p.id} | User: {p.user.phone} | Pkg: {p.package.code if p.package else None} | Status: {p.status} | Created: {p.created_at}")

cfg = CommissionConfig.get_solo()
m = cfg.master_commission_json or {}
print()
print("=== COMMISSION CONFIG in STAGING DB ===")
p750 = m.get('prime_750', {}) or m.get('commissions', {}).get('prime_750', {})
print("PRIME 750:", json.dumps(p750, indent=2))
m759 = m.get('monthly_759', {}) or m.get('commissions', {}).get('monthly_759', {})
print("MONTHLY 759:", json.dumps(m759, indent=2))
spp_1000 = m.get('spp_1000_config', {})
print("SPP 1000:", json.dumps(spp_1000, indent=2))
"""

local_tmp = r"C:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\_tmp_inspect.py"
with open(local_tmp, "w", encoding="utf-8") as f:
    f.write(remote_script_code)

scp_cmd = [
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    local_tmp, f"ubuntu@{ec2_ip}:/tmp/check_staging.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    "sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_staging.py'"
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

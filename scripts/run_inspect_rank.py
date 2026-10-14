import subprocess

script_code = """
import sys, os
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from accounts.models import CustomUser
from mlm_ranks.models import Rank, UserRank, RankUpgrade

print("--- RANKS DEFINED ---")
for r in Rank.objects.all():
    print(r.id, f"L{r.level_number}", r.rank_name, r.upgrade_amount)

print("\\n--- ACTIVE CONSUMERS CURRENT RANK ---")
for u in CustomUser.objects.filter(category='consumer', account_active=True).order_by('first_purchase_activated_at'):
    ur = UserRank.objects.filter(user=u).first()
    rank_str = f"L{ur.current_rank.level_number} ({ur.current_rank.rank_name})" if (ur and ur.current_rank) else "None"
    upgrades = list(RankUpgrade.objects.filter(user=u, payment_status='SUCCESS').values_list('to_rank__level_number', flat=True))
    print(f"ID #{u.id} | {u.username} | {u.first_purchase_activated_at} | Rank: {rank_str} | Success Upgrades: {upgrades}")
"""

with open("scripts/remote_inspect_rank.py", "w") as f:
    f.write(script_code)

# scp and run
subprocess.run([
    "scp", "-i", r"C:\Users\babur\Downloads\TRI_MARKETING.pem",
    "-o", "StrictHostKeyChecking=no",
    "scripts/remote_inspect_rank.py",
    "ubuntu@65.0.40.184:/tmp/remote_inspect_rank.py"
], check=True)

out = subprocess.check_output([
    "ssh", "-i", r"C:\Users\babur\Downloads\TRI_MARKETING.pem",
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "sudo -u trikonekt /srv/trikonekt/staging/backend/.venv/bin/python /tmp/remote_inspect_rank.py"
]).decode()

print(out)

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_code = '''
from business.models import BusinessRegistration, FranchisePayout
from accounts.models import AgencyRegionAssignment, WalletAccount

print("--- BusinessRegistration fields ---")
for f in BusinessRegistration._meta.get_fields():
    if not f.is_relation or f.many_to_one:
        print("  ", f.name)

print("Total BusinessRegistrations in DB:", BusinessRegistration.objects.count())
for b in BusinessRegistration.objects.all()[:5]:
    print("  Merchant:", b.id, getattr(b, "business_name", ""), getattr(b, "owner_name", ""), getattr(b, "pincode", ""), getattr(b, "mobile_number", ""))

print("--- FranchisePayout fields ---")
for f in FranchisePayout._meta.get_fields():
    if not f.is_relation or f.many_to_one:
        print("  ", f.name)

print("Total FranchisePayout in DB:", FranchisePayout.objects.count())
for fp in FranchisePayout.objects.all()[:5]:
    print("  Payout:", fp.id, getattr(fp, "user", ""), getattr(fp, "amount", ""), getattr(fp, "tier", ""))
'''

with open("scripts/tmp_inspect_br.py", "w") as f:
    f.write(remote_code)

subprocess.run(["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_inspect_br.py", "ubuntu@65.0.40.184:/tmp/tmp_inspect_br.py"], check=True)
cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "cd /srv/trikonekt/staging/backend && set -a && . /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python manage.py shell < /tmp/tmp_inspect_br.py"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)

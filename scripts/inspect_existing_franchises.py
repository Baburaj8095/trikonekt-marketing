import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_code = """
from accounts.models import CustomUser, AgencyRegionAssignment

agencies = list(CustomUser.objects.filter(category__startswith='agency_').values('id', 'phone', 'category', 'username'))
print(f"Total Existing Agency Users: {len(agencies)}")
for a in agencies[:10]:
    print("  ", a)

assignments = list(AgencyRegionAssignment.objects.all().values('id', 'user__phone', 'level', 'pincode', 'district', 'state__name'))
print(f"Total Existing Region Assignments: {len(assignments)}")
for ass in assignments[:10]:
    print("  ", ass)
"""

with open("scripts/tmp_check_agencies.py", "w") as f:
    f.write(remote_code)

subprocess.run(["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_check_agencies.py", "ubuntu@65.0.40.184:/tmp/tmp_check_agencies.py"], check=True)
cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "cd /srv/trikonekt/staging/backend && set -a && . /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python manage.py shell < /tmp/tmp_check_agencies.py"
]
res = subprocess.run(cmd, capture_output=True, text=True)

print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)


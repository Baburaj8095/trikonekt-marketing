import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_code = '''
from accounts.models import CustomUser

print("--- CustomUser fields ---")
for f in CustomUser._meta.get_fields():
    if not f.is_relation:
        if any(w in f.name.lower() for w in ['role', 'cat', 'type', 'cap', 'is_', 'agency', 'fran']):
            print("  ", f.name)

print("Unique categories in CustomUser:", list(CustomUser.objects.values_list('category', flat=True).distinct()))
print("Unique roles in CustomUser:", list(CustomUser.objects.values_list('role', flat=True).distinct()) if hasattr(CustomUser, 'role') else "No role field")
'''

with open("scripts/tmp_inspect_user_cap.py", "w") as f:
    f.write(remote_code)

subprocess.run(["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_inspect_user_cap.py", "ubuntu@65.0.40.184:/tmp/tmp_inspect_user_cap.py"], check=True)
cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "cd /srv/trikonekt/staging/backend && set -a && . /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python manage.py shell < /tmp/tmp_inspect_user_cap.py"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
remote_code = '''
import django
django.setup()
from django.apps import apps

print("=== APPS AND MODELS ===")
for app in ['business', 'accounts', 'core']:
    try:
        app_config = apps.get_app_config(app)
        print(f"App: {app}")
        for m in app_config.get_models():
            print(f"  Model: {m.__name__}")
    except Exception as e:
        print(f"Error {app}: {e}")
'''

with open("scripts/tmp_inspect_models.py", "w") as f:
    f.write(remote_code)

subprocess.run(["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "scripts/tmp_inspect_models.py", "ubuntu@65.0.40.184:/tmp/tmp_inspect_models.py"], check=True)
cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    "ubuntu@65.0.40.184",
    "cd /srv/trikonekt/staging/backend && set -a && . /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python manage.py shell < /tmp/tmp_inspect_models.py"
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)

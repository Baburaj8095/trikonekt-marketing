import subprocess
import os

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

files = [
    ("backend/business/models.py", "/tmp/models.py", "/srv/trikonekt/staging/backend/business/models.py"),
    ("backend/business/services/self_rebirth.py", "/tmp/self_rebirth.py", "/srv/trikonekt/staging/backend/business/services/self_rebirth.py"),
    ("backend/business/views_ssv.py", "/tmp/views_ssv.py", "/srv/trikonekt/staging/backend/business/views_ssv.py"),
    ("backend/business/urls.py", "/tmp/urls.py", "/srv/trikonekt/staging/backend/business/urls.py"),
    ("backend/adminapi/urls.py", "/tmp/adminapi_urls.py", "/srv/trikonekt/staging/backend/adminapi/urls.py"),
]

print("1. SCP files to EC2...")
for local_rel, tmp_f, _ in files:
    local_f = os.path.join(r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing", local_rel)
    scp_cmd = ["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", local_f, f"ubuntu@{ec2_ip}:{tmp_f}"]
    subprocess.run(scp_cmd, check=True)

print("2. Copy to backend and set ownership...")
remote_copy = """
sudo cp /tmp/models.py /srv/trikonekt/staging/backend/business/models.py
sudo cp /tmp/self_rebirth.py /srv/trikonekt/staging/backend/business/services/self_rebirth.py
sudo cp /tmp/views_ssv.py /srv/trikonekt/staging/backend/business/views_ssv.py
sudo cp /tmp/urls.py /srv/trikonekt/staging/backend/business/urls.py
sudo cp /tmp/adminapi_urls.py /srv/trikonekt/staging/backend/adminapi/urls.py
sudo chown www-data:www-data /srv/trikonekt/staging/backend/business/models.py /srv/trikonekt/staging/backend/business/services/self_rebirth.py /srv/trikonekt/staging/backend/business/views_ssv.py /srv/trikonekt/staging/backend/business/urls.py /srv/trikonekt/staging/backend/adminapi/urls.py
"""
subprocess.run(["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", remote_copy], check=True)

print("3. Run makemigrations and migrate on EC2...")
remote_migrate = """
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/staging/backend/manage.py makemigrations business'
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/staging/backend/manage.py migrate'
sudo systemctl restart trikonekt-staging-web.service
sudo systemctl is-active trikonekt-staging-web.service
"""
res = subprocess.run(["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", remote_migrate], capture_output=True, text=True, timeout=60)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

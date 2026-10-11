import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

# 1. SCP views.py and urls.py
for f_rel in ["backend/adminapi/views.py", "backend/adminapi/urls.py"]:
    local_f = rf"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\{f_rel}"
    remote_f = f"/tmp/{f_rel.split('/')[-1]}"
    scp_cmd = ["scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", local_f, f"ubuntu@{ec2_ip}:{remote_f}"]
    subprocess.run(scp_cmd, check=True)

# 2. Move to /srv/trikonekt/staging/backend/adminapi/ and compile
remote_cmd = """
sudo cp /tmp/views.py /srv/trikonekt/staging/backend/adminapi/views.py
sudo cp /tmp/urls.py /srv/trikonekt/staging/backend/adminapi/urls.py
sudo /srv/trikonekt/staging/backend/.venv/bin/python -m py_compile /srv/trikonekt/staging/backend/adminapi/views.py
sudo /srv/trikonekt/staging/backend/.venv/bin/python -m py_compile /srv/trikonekt/staging/backend/adminapi/urls.py
sudo systemctl restart trikonekt-staging-web.service
sudo systemctl is-active trikonekt-staging-web.service
"""

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    remote_cmd
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=30)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

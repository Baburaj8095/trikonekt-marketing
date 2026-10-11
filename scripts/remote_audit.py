import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

# 1. SCP reset_user.py to EC2
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\.agents\skills\user-growth-reset\scripts\reset_user.py",
    f"ubuntu@{ec2_ip}:/tmp/reset_user.py"
]
subprocess.run(scp_cmd, check=True)

# 2. Move to /srv/trikonekt/scripts/ and run reset for both users
remote_cmd = """
sudo mkdir -p /srv/trikonekt/scripts
sudo cp /tmp/reset_user.py /srv/trikonekt/scripts/reset_user.py
sudo chmod +x /srv/trikonekt/scripts/reset_user.py

echo "=== RESETTING USER 8095918105 ==="
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 8095918105 --action reset'

echo "=== RESETTING USER 9999999999 ==="
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 9999999999 --action reset'
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    remote_cmd
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout.encode('ascii', errors='replace').decode('ascii'))
if res.stderr:
    print("STDERR:", res.stderr.encode('ascii', errors='replace').decode('ascii'))

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

# 1. SCP reset_user.py
scp_cmd = [
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\.agents\skills\user-growth-reset\scripts\reset_user.py",
    f"ubuntu@{ec2_ip}:/tmp/reset_user.py"
]
subprocess.run(scp_cmd, check=True)

# 2. Run reset on EC2
remote_cmd = """
sudo mkdir -p /srv/trikonekt/scripts
sudo cp /tmp/reset_user.py /srv/trikonekt/scripts/reset_user.py
sudo chmod +x /srv/trikonekt/scripts/reset_user.py

echo "=== RESETTING USER 1000000102 ==="
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 1000000102 --action reset'

echo "=== RESETTING USER 1000000101 ==="
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 1000000101 --action reset'

echo "=== RESETTING USER 8095918105 ==="
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 8095918105 --action reset'

echo "=== RESETTING USER 9999999999 ==="
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 9999999999 --action reset'
"""

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    remote_cmd
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=120)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

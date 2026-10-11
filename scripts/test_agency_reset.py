import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

# Run reset on agency 9800000006
remote_cmd = """
sudo bash -c 'set -a && source /etc/trikonekt/staging-backend.env && set +a && /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/scripts/reset_user.py --phone 9800000006 --action reset'
"""

exec_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    remote_cmd
]
res = subprocess.run(exec_cmd, capture_output=True, text=True, timeout=60)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

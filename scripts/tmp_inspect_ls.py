import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_code = """
import os
print("CWD:", os.getcwd())
print("Files in backend:", os.listdir('/srv/trikonekt/staging/backend'))
"""

cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"sudo env $(sudo cat /etc/trikonekt/staging-backend.env | xargs) /srv/trikonekt/staging/backend/.venv/bin/python -c \"{remote_code}\""
]
res = subprocess.run(cmd, capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_script = r'''
import re

with open("/srv/trikonekt/staging/backend/accounts/views.py", "r", encoding="utf-8") as f:
    text = f.read()

# search for history or main_income_balance
matches = [m.start() for m in re.finditer(r'main_income_balance', text)]
for idx in matches:
    start = max(0, idx - 400)
    end = min(len(text), idx + 800)
    print("=== MATCH FOR main_income_balance ===")
    print(text[start:end])
'''

with open("scripts/read_wallet_views.py", "w", encoding="utf-8") as f:
    f.write(remote_script)

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\read_wallet_views.py",
    f"{ec2_user}@{ec2_ip}:/tmp/read_wallet_views.py"
]
subprocess.run(scp_cmd, check=True)

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/read_wallet_views.py"
]
subprocess.run(ssh_cmd, check=True)

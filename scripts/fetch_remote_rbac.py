import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}:/srv/trikonekt/staging/backend/adminapi/views_rbac.py",
    r"scripts\remote_views_rbac.py"
]
subprocess.run(scp_cmd, check=True)
print("Fetched remote views_rbac.py successfully!")

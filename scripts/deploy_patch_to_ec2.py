import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

print("Uploading patch_target.py...")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    r"scripts\patch_target.py",
    f"{ec2_user}@{ec2_ip}:/tmp/patch_target.py"
]
subprocess.run(scp_cmd, check=True)

print("Executing patch on EC2...")
ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "/srv/trikonekt/staging/backend/.venv/bin/python /tmp/patch_target.py && sudo systemctl restart trikonekt-staging-web"
]
subprocess.run(ssh_cmd, check=True)
print("EC2 views_rbac.py updated & service restarted successfully!")

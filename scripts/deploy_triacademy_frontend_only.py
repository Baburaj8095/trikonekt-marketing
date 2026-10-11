import subprocess
import os
import tarfile

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
workspace_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing"
dist_dir = os.path.join(workspace_dir, "tri-academy", "frontend", "dist")
archive_path = os.path.join(workspace_dir, "triacademy-dist.tar.gz")

print("=== Step 1: Packaging tri-academy frontend dist ===")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(dist_dir, arcname="dist")

print("=== Step 2: Uploading dist archive to EC2 ===")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    archive_path,
    f"{ec2_user}@{ec2_ip}:/tmp/"
]
subprocess.run(scp_cmd, check=True)

print("=== Step 3: Deploying new build to /srv/trikonekt/tri-academy/frontend/dist ===")
remote_script = """
set -e
sudo mkdir -p /srv/trikonekt/tri-academy/frontend/dist
sudo tar -xzf /tmp/triacademy-dist.tar.gz -C /tmp/
sudo cp -r /tmp/dist/* /srv/trikonekt/tri-academy/frontend/dist/
sudo chown -R ubuntu:ubuntu /srv/trikonekt/tri-academy/frontend/dist
sudo chmod -R 755 /srv/trikonekt/tri-academy/frontend/dist
sudo rm -rf /tmp/dist /tmp/triacademy-dist.tar.gz
sudo systemctl reload nginx
echo "[Remote] Tri-Academy frontend build deployed and Nginx reloaded successfully!"
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_script
]
subprocess.run(ssh_cmd, check=True)

if os.path.exists(archive_path):
    os.remove(archive_path)

print("=== Tri-Academy Frontend Live on trieducation.in! ===")

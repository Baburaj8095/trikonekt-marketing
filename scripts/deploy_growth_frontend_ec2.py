#!/usr/bin/env python3
import os
import sys
import tarfile
import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
workspace_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing"
build_dir = os.path.join(workspace_dir, "frontend", "build")
archive_path = os.path.join(workspace_dir, "frontend-build.tar.gz")

print(f"=== Step 1: Packaging {build_dir} ===")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")

print(f"Archive created at: {archive_path} ({os.path.getsize(archive_path) / 1024:.1f} KB)")

print(f"=== Step 2: Uploading to EC2 ({ec2_ip}) ===")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    archive_path,
    f"{ec2_user}@{ec2_ip}:/tmp/"
]
subprocess.run(scp_cmd, check=True)

print("=== Step 3: Extracting to /srv/trikonekt/staging/frontend/build and reloading ===")
remote_script = """
set -e
echo "[Remote] Backing up and extracting new build..."
sudo mkdir -p /srv/trikonekt/staging/frontend/build
sudo tar -xzf /tmp/frontend-build.tar.gz -C /tmp/
sudo cp -r /tmp/build/* /srv/trikonekt/staging/frontend/build/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build
sudo rm -rf /tmp/build /tmp/frontend-build.tar.gz
sudo systemctl reload nginx
echo "[Remote] Deployment complete! Nginx reloaded."
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_script
]
subprocess.run(ssh_cmd, check=True)
print("=== Growth Frontend Deployment Successfully Completed! ===")

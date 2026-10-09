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

print("=== 1. Uploading backend files ===")
backend_views = os.path.join(workspace_dir, "backend", "adminapi", "views.py")
backend_urls = os.path.join(workspace_dir, "backend", "adminapi", "urls.py")

subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    backend_views, backend_urls,
    f"{ec2_user}@{ec2_ip}:/tmp/"
], check=True)

print("=== 2. Applying backend updates on EC2 ===")
remote_backend_cmds = """
set -e
echo "[Remote] Copying views.py and urls.py..."
sudo cp /tmp/views.py /srv/trikonekt/staging/backend/adminapi/views.py
sudo cp /tmp/urls.py /srv/trikonekt/staging/backend/adminapi/urls.py
sudo chown trikonekt:trikonekt /srv/trikonekt/staging/backend/adminapi/views.py /srv/trikonekt/staging/backend/adminapi/urls.py
sudo rm -f /tmp/views.py /tmp/urls.py

echo "[Remote] Restarting backend web service..."
sudo systemctl restart trikonekt-staging-web.service
sudo systemctl status trikonekt-staging-web.service --no-pager | head -n 12
"""

subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_backend_cmds
], check=True)

print(f"=== 3. Packaging frontend {build_dir} ===")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")

print(f"Archive created at: {archive_path} ({os.path.getsize(archive_path) / 1024:.1f} KB)")

print(f"=== 4. Uploading frontend archive to EC2 ===")
subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    archive_path, f"{ec2_user}@{ec2_ip}:/tmp/"
], check=True)

print("=== 5. Extracting frontend to /srv/trikonekt/staging/frontend/build and reloading nginx ===")
remote_frontend_cmds = """
set -e
echo "[Remote] Backing up and extracting new build..."
sudo mkdir -p /srv/trikonekt/staging/frontend/build
sudo tar -xzf /tmp/frontend-build.tar.gz -C /tmp/
sudo cp -r /tmp/build/* /srv/trikonekt/staging/frontend/build/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build
sudo rm -rf /tmp/build /tmp/frontend-build.tar.gz
sudo systemctl reload nginx
echo "[Remote] Nginx reloaded successfully!"
"""

subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_frontend_cmds
], check=True)

print("=== Deployment to asiyapp.com successfully completed! ===")

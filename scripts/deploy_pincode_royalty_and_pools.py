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

backend_admin_views = os.path.join(workspace_dir, "backend", "adminapi", "views.py")
backend_self_rebirth = os.path.join(workspace_dir, "backend", "business", "services", "self_rebirth.py")
backend_daily_pool = os.path.join(workspace_dir, "backend", "business", "services", "daily_pool_distributor.py")

print("=== Step 1: Packaging frontend build ===")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")

print(f"Frontend archive created: {os.path.getsize(archive_path) / 1024:.1f} KB")

print("=== Step 2: Uploading files to EC2 ===")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    archive_path,
    backend_admin_views,
    backend_self_rebirth,
    backend_daily_pool,
    f"{ec2_user}@{ec2_ip}:/tmp/"
]
subprocess.run(scp_cmd, check=True)
print("Files uploaded to /tmp/")

print("=== Step 3: Installing backend updates & frontend build on EC2 ===")
remote_script = """
set -e
echo "[Remote] Copying backend files to /srv/trikonekt/staging/backend/..."
sudo cp /tmp/views.py /srv/trikonekt/staging/backend/adminapi/views.py
sudo cp /tmp/self_rebirth.py /srv/trikonekt/staging/backend/business/services/self_rebirth.py
sudo cp /tmp/daily_pool_distributor.py /srv/trikonekt/staging/backend/business/services/daily_pool_distributor.py

echo "[Remote] Extracting frontend build..."
sudo mkdir -p /srv/trikonekt/staging/frontend/build
sudo tar -xzf /tmp/frontend-build.tar.gz -C /tmp/
sudo cp -r /tmp/build/* /srv/trikonekt/staging/frontend/build/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build

echo "[Remote] Cleaning temp files..."
sudo rm -rf /tmp/build /tmp/frontend-build.tar.gz /tmp/views.py /tmp/self_rebirth.py /tmp/daily_pool_distributor.py

echo "[Remote] Restarting backend and reloading Nginx..."
sudo systemctl restart trikonekt-staging-web.service
sudo systemctl restart trikonekt-staging-worker.service
sudo systemctl reload nginx

echo "[Remote] Checking service status..."
sudo systemctl is-active trikonekt-staging-web.service
sudo systemctl is-active trikonekt-staging-worker.service
sudo systemctl is-active nginx
echo "=== Deployment to asiyapp.com completed successfully! ==="
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"bash -c '{remote_script}'"
]
res = subprocess.run(ssh_cmd, check=True)
print("Deployment script finished successfully!")

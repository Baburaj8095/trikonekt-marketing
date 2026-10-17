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

backend_files = [
    (os.path.join(workspace_dir, "backend", "accounts", "views.py"), "/srv/trikonekt/staging/backend/accounts/views.py"),
    (os.path.join(workspace_dir, "backend", "business", "views_ssv.py"), "/srv/trikonekt/staging/backend/business/views_ssv.py"),
    (os.path.join(workspace_dir, "backend", "accounts", "serializers.py"), "/srv/trikonekt/staging/backend/accounts/serializers.py"),
    (os.path.join(workspace_dir, "backend", "adminapi", "serializers.py"), "/srv/trikonekt/staging/backend/adminapi/serializers.py"),
    (os.path.join(workspace_dir, "backend", "accounts", "admin.py"), "/srv/trikonekt/staging/backend/accounts/admin.py"),
]

print("=== Step 1: Packaging frontend build ===")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")

print(f"Frontend archive created: {os.path.getsize(archive_path) / 1024:.1f} KB")

print("=== Step 2: Uploading frontend archive to EC2 ===")
subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    archive_path, f"{ec2_user}@{ec2_ip}:/tmp/frontend-build.tar.gz"
], check=True)

print("=== Step 3: Uploading backend files to EC2 ===")
for local_path, remote_target in backend_files:
    tmp_name = f"/tmp/{os.path.basename(os.path.dirname(remote_target))}_{os.path.basename(remote_target)}"
    subprocess.run([
        "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        local_path, f"{ec2_user}@{ec2_ip}:{tmp_name}"
    ], check=True)
    
    install_cmd = f"sudo cp {tmp_name} {remote_target} && sudo chown trikonekt:trikonekt {remote_target} && sudo rm {tmp_name}"
    subprocess.run([
        "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        f"{ec2_user}@{ec2_ip}", install_cmd
    ], check=True)
    print(f"Installed {remote_target}")

print("=== Step 4: Extracting frontend and reloading Nginx/Services ===")
remote_script = """
set -e
echo "[Remote] Extracting frontend build..."
sudo mkdir -p /srv/trikonekt/staging/frontend/build
sudo tar -xzf /tmp/frontend-build.tar.gz -C /tmp/
sudo cp -r /tmp/build/* /srv/trikonekt/staging/frontend/build/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build
sudo rm -rf /tmp/build /tmp/frontend-build.tar.gz

echo "[Remote] Restarting backend and reloading Nginx..."
sudo systemctl restart trikonekt-staging-web.service
sudo systemctl restart trikonekt-staging-worker.service
sudo systemctl reload nginx

echo "[Remote] Service Status:"
sudo systemctl is-active trikonekt-staging-web.service
sudo systemctl is-active trikonekt-staging-worker.service
sudo systemctl is-active nginx
"""

subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_script
], check=True)

if os.path.exists(archive_path):
    os.remove(archive_path)

print("=== Deployment to asiyapp.com Successfully Completed! ===")

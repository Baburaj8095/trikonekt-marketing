import subprocess
import os
import tarfile

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
workspace_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing"
build_dir = os.path.join(workspace_dir, "frontend", "build")
archive_path = os.path.join(workspace_dir, "frontend-build.tar.gz")

print("=== Step 1: Packaging frontend build ===")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")

print("=== Step 2: Uploading frontend to EC2 ===")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    archive_path,
    f"{ec2_user}@{ec2_ip}:/tmp/"
]
subprocess.run(scp_cmd, check=True)

print("=== Step 3: Deploying backend + frontend on EC2 ===")
remote_script = """
set -e
echo "[Remote] Pulling latest git staging on backend..."
cd /srv/trikonekt/staging
sudo git config --global --add safe.directory /srv/trikonekt/staging
sudo git pull origin staging

echo "[Remote] Extracting new frontend build..."
sudo mkdir -p /srv/trikonekt/staging/frontend/build
sudo tar -xzf /tmp/frontend-build.tar.gz -C /tmp/
sudo cp -r /tmp/build/* /srv/trikonekt/staging/frontend/build/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build
sudo rm -rf /tmp/build /tmp/frontend-build.tar.gz

echo "[Remote] Restarting staging backend services..."
sudo systemctl restart trikonekt-staging-web.service
sudo systemctl restart trikonekt-staging-worker.service
sudo systemctl reload nginx

echo "[Remote] Deployment complete!"
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_script
]
subprocess.run(ssh_cmd, check=True)
print("=== Full Deployment to EC2 Staging Completed! ===")

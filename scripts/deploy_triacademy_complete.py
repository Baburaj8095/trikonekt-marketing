import subprocess
import os
import tarfile

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
workspace_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing"

# 1. Deploy backend files
files_to_upload = [
    (r"tri-academy\backend\src\scripts\growth_bridge_exec.py", "/srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_exec.py"),
    (r"tri-academy\backend\src\controllers\orderController.js", "/srv/trikonekt/tri-academy/backend/src/controllers/orderController.js"),
    (r"tri-academy\backend\src\services\growthBridgeService.js", "/srv/trikonekt/tri-academy/backend/src/services/growthBridgeService.js"),
]

print("=== Step 1: Uploading Backend Files ===")
for local_rel, remote_path in files_to_upload:
    local_path = os.path.join(workspace_dir, local_rel)
    print(f"Uploading {local_rel} -> {remote_path}...")
    tmp_path = f"/tmp/{os.path.basename(local_rel)}"
    subprocess.run([
        "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        local_path, f"{ec2_user}@{ec2_ip}:{tmp_path}"
    ], check=True)
    subprocess.run([
        "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        f"{ec2_user}@{ec2_ip}",
        f"sudo cp {tmp_path} {remote_path} && sudo chown trikonekt:trikonekt {remote_path} && sudo chmod 755 {remote_path}"
    ], check=True)

# 2. Deploy frontend dist
print("=== Step 2: Packaging and Uploading Frontend Dist ===")
dist_dir = os.path.join(workspace_dir, "tri-academy", "frontend", "dist")
archive_path = os.path.join(workspace_dir, "triacademy-dist.tar.gz")

with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(dist_dir, arcname="dist")

subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    archive_path, f"{ec2_user}@{ec2_ip}:/tmp/triacademy-dist.tar.gz"
], check=True)

# 3. Remote extraction and service restart
print("=== Step 3: Extracting Frontend & Restarting Services ===")
remote_cmds = """
set -e
sudo mkdir -p /srv/trikonekt/tri-academy/frontend/dist
sudo tar -xzf /tmp/triacademy-dist.tar.gz -C /tmp/
sudo cp -r /tmp/dist/* /srv/trikonekt/tri-academy/frontend/dist/
sudo chown -R ubuntu:ubuntu /srv/trikonekt/tri-academy/frontend/dist
sudo chmod -R 755 /srv/trikonekt/tri-academy/frontend/dist
sudo rm -rf /tmp/dist /tmp/triacademy-dist.tar.gz

echo "Restarting services..."
sudo systemctl restart trikonekt-growth-bridge
sudo systemctl restart trikonekt-academy
sudo systemctl reload nginx
echo "All services active and updated!"
"""

subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_cmds
], check=True)

if os.path.exists(archive_path):
    os.remove(archive_path)

print("=== Deployment Complete! ===")

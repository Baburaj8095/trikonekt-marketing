#!/usr/bin/env python3
import os
import sys
import tarfile
import subprocess
import shutil

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
workspace_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing"
academy_dir = os.path.join(workspace_dir, "tri-academy")
archive_path = os.path.join(workspace_dir, "tri-academy-deploy.tar.gz")

print("=== Step 1: Packaging tri-academy (excluding node_modules) ===")
def filter_tar(tarinfo):
    if "node_modules" in tarinfo.name or ".git" in tarinfo.name or "dist" in tarinfo.name:
        return None
    return tarinfo

with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(academy_dir, arcname="tri-academy", filter=filter_tar)

print(f"Archive created at: {archive_path} ({os.path.getsize(archive_path) / 1024:.1f} KB)")

print(f"=== Step 2: Uploading to EC2 ({ec2_ip}) ===")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    archive_path,
    os.path.join(workspace_dir, "deploy", "aws", "nginx-triacademy.conf"),
    os.path.join(workspace_dir, "deploy", "aws", "nginx-trieducation.conf"),
    os.path.join(workspace_dir, "deploy", "aws", "trikonekt-academy.service"),
    f"{ec2_user}@{ec2_ip}:/tmp/"
]
subprocess.run(scp_cmd, check=True)

print("=== Step 3: Executing Remote Setup & Build ===")
remote_script = """
set -e

echo "[Remote] 1. Extracting /tmp/tri-academy-deploy.tar.gz to /srv/trikonekt/..."
sudo mkdir -p /srv/trikonekt/tri-academy
sudo mkdir -p /srv/trikonekt/media/videos
sudo tar -xzf /tmp/tri-academy-deploy.tar.gz -C /srv/trikonekt/
sudo chown -R ubuntu:ubuntu /srv/trikonekt/tri-academy
sudo chown -R www-data:ubuntu /srv/trikonekt/media
sudo chmod -R 775 /srv/trikonekt/tri-academy /srv/trikonekt/media


echo "[Remote] 2. Installing Backend Dependencies..."
cd /srv/trikonekt/tri-academy/backend
npm install --omit=dev

echo "[Remote] 3. Installing Frontend Dependencies and Building..."
cd /srv/trikonekt/tri-academy/frontend
npm install
npm run build

echo "[Remote] Setting final trikonekt user permissions..."
sudo chown -R trikonekt:trikonekt /srv/trikonekt/tri-academy

echo "[Remote] 4. Setting up Systemd Service..."
sudo cp /tmp/trikonekt-academy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable trikonekt-academy
sudo systemctl restart trikonekt-academy

echo "[Remote] 5. Configuring Nginx for triacademy.trikonekt.com & trieducation.in..."
# 5a. triacademy.trikonekt.com
if sudo test -f "/etc/letsencrypt/live/triacademy.trikonekt.com/fullchain.pem"; then
    echo "[Remote] Existing SSL certificates found for triacademy.trikonekt.com."
    sudo cp /tmp/nginx-triacademy.conf /etc/nginx/sites-available/triacademy.trikonekt.com
else
    echo "[Remote] Creating temporary bootstrap config for triacademy.trikonekt.com..."
    sudo tee /etc/nginx/sites-available/triacademy.trikonekt.com > /dev/null << 'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name triacademy.trikonekt.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        root /srv/trikonekt/tri-academy/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
EOF
fi
sudo ln -sf /etc/nginx/sites-available/triacademy.trikonekt.com /etc/nginx/sites-enabled/

# 5b. trieducation.in
echo "[Remote] Setting up Nginx site for trieducation.in..."
sudo cp /tmp/nginx-trieducation.conf /etc/nginx/sites-available/trieducation.in
sudo ln -sf /etc/nginx/sites-available/trieducation.in /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl reload nginx

# Check if trieducation.in has SSL or if DNS has resolved to request SSL
if sudo test -f "/etc/letsencrypt/live/trieducation.in/fullchain.pem"; then
    echo "[Remote] SSL certificate already active for trieducation.in."
else
    echo "[Remote] Checking if trieducation.in DNS is pointed to this server..."
    RESOLVED_IP=$(getent hosts trieducation.in | awk '{print $1}' || true)
    if [ "$RESOLVED_IP" = "65.0.40.184" ]; then
        echo "[Remote] trieducation.in resolves to this server (65.0.40.184). Requesting SSL certificate..."
        sudo certbot --nginx -d trieducation.in -d www.trieducation.in --non-interactive --agree-tos -m contact@trikonekt.com --redirect || true
        sudo nginx -t
        sudo systemctl reload nginx
    else
        echo "[Remote] NOTE: trieducation.in DNS currently resolves to '$RESOLVED_IP'. Once DNS A record points to 65.0.40.184, run certbot to activate SSL."
    fi
fi

echo "[Remote] === DEPLOYMENT FINISHED SUCCESSFULLY ==="
sudo systemctl status trikonekt-academy --no-pager
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_script
]
subprocess.run(ssh_cmd, check=True)

# Clean local archive
if os.path.exists(archive_path):
    os.remove(archive_path)

print("[SUCCESS] Deployment Complete: https://triacademy.trikonekt.com")

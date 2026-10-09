#!/usr/bin/env python3
import os
import sys
import subprocess

ssh_key_path = r"C:\Users\Baburaj\.ssh\trikonekt-prod-key.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

if not os.path.exists(ssh_key_path):
    print(f"ERROR: SSH key not found at {ssh_key_path}")
    sys.exit(1)

print(f"Connecting to EC2 ({ec2_user}@{ec2_ip}) to activate Staging Environment...")

remote_commands = """
set -e

echo "=== Step 1: Updating Git repository at /srv/trikonekt/app ==="
if [ -d "/srv/trikonekt/app" ]; then
    sudo -u trikonekt git -C /srv/trikonekt/app fetch origin main
    sudo -u trikonekt git -C /srv/trikonekt/app reset --hard origin/main
fi

echo "=== Step 2: Creating Staging Database (trikonekt_staging) ==="
if [ -f "/srv/trikonekt/app/deploy/aws/setup-staging-db.sql" ]; then
    sudo -u postgres psql -f /srv/trikonekt/app/deploy/aws/setup-staging-db.sql || true
fi

echo "=== Step 3: Copying Staging Environment & Service Files ==="
if [ -f "/srv/trikonekt/app/deploy/aws/staging-backend.env.example" ] && [ ! -f "/etc/trikonekt/staging-backend.env" ]; then
    sudo cp /srv/trikonekt/app/deploy/aws/staging-backend.env.example /etc/trikonekt/staging-backend.env
fi

if [ -f "/srv/trikonekt/app/deploy/aws/trikonekt-staging-web.service" ]; then
    sudo cp /srv/trikonekt/app/deploy/aws/trikonekt-staging-web.service /etc/systemd/system/
fi

if [ -f "/srv/trikonekt/app/deploy/aws/trikonekt-staging-worker.service" ]; then
    sudo cp /srv/trikonekt/app/deploy/aws/trikonekt-staging-worker.service /etc/systemd/system/
fi

sudo systemctl daemon-reload

echo "=== Step 4: Configuring Nginx for Staging ==="
if [ -f "/srv/trikonekt/app/deploy/aws/nginx-staging-growth.conf" ]; then
    sudo cp /srv/trikonekt/app/deploy/aws/nginx-staging-growth.conf /etc/nginx/sites-available/staging-growth.vin
    sudo ln -sf /etc/nginx/sites-available/staging-growth.vin /etc/nginx/sites-enabled/
fi

echo "=== Step 5: Setting up SSL Certificate via Certbot ==="
sudo certbot --nginx -d staging-growth.vin -d staging-api.growth.vin --non-interactive --agree-tos -m contact@trikonekt.com --redirect || true

echo "=== Step 6: Starting Staging Services & Reloading Nginx ==="
sudo systemctl enable trikonekt-staging-web trikonekt-staging-worker || true
sudo systemctl restart trikonekt-staging-web trikonekt-staging-worker || true
sudo systemctl reload nginx

echo "=== STAGING ACTIVATION COMPLETE ==="
sudo systemctl status trikonekt-staging-web --no-pager || true
"""

ssh_cmd = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_commands
]

try:
    result = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=120)
    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)
    print("Exit Code:", result.returncode)
except Exception as e:
    print("Execution Error:", e)

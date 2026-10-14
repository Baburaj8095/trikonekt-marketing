import subprocess
import os

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

files_to_upload = [
    (r"tri-academy\backend\src\scripts\growth_bridge_exec.py", "/srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_exec.py"),
    (r"tri-academy\backend\src\scripts\growth_bridge_daemon.py", "/srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_daemon.py"),
    (r"tri-academy\backend\src\services\growthBridgeService.js", "/srv/trikonekt/tri-academy/backend/src/services/growthBridgeService.js"),
    (r"tri-academy\backend\src\controllers\authController.js", "/srv/trikonekt/tri-academy/backend/src/controllers/authController.js"),
    (r"tri-academy\backend\src\controllers\walletController.js", "/srv/trikonekt/tri-academy/backend/src/controllers/walletController.js"),
]

print("Uploading updated files to EC2...")
for local_path, remote_path in files_to_upload:
    print(f"Uploading {local_path} -> {remote_path}...")
    tmp_path = f"/tmp/{os.path.basename(local_path)}"
    subprocess.run([
        "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        local_path, f"{ec2_user}@{ec2_ip}:{tmp_path}"
    ], check=True)
    subprocess.run([
        "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        f"{ec2_user}@{ec2_ip}",
        f"sudo cp {tmp_path} {remote_path} && sudo chown trikonekt:trikonekt {remote_path} && sudo chmod 755 {remote_path}"
    ], check=True)

print("Configuring systemd service for trikonekt-growth-bridge...")
systemd_unit = """[Unit]
Description=Trikonekt Growth DB Bridge Persistent Daemon Service
After=network.target

[Service]
Type=simple
User=trikonekt
WorkingDirectory=/srv/trikonekt/tri-academy/backend
Environment=NODE_ENV=production
Environment=BRIDGE_DAEMON_PORT=5006
ExecStart=/srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/tri-academy/backend/src/scripts/growth_bridge_daemon.py
Restart=always
RestartSec=3
StandardOutput=journal
StandardError=journal
SyslogIdentifier=growth-bridge-daemon

[Install]
WantedBy=multi-user.target
"""

proc = subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"echo '{systemd_unit}' | sudo tee /etc/systemd/system/trikonekt-growth-bridge.service > /dev/null && "
    "sudo systemctl daemon-reload && "
    "sudo systemctl enable trikonekt-growth-bridge && "
    "sudo systemctl restart trikonekt-growth-bridge && "
    "sudo systemctl restart trikonekt-academy"
], capture_output=True, text=True, check=True)

print("Systemd setup completed successfully!")

import os
import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
backend_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\backend"

files_to_sync = [
    (os.path.join(backend_dir, "adminapi", "views.py"), "/srv/trikonekt/staging/backend/adminapi/views.py"),
    (os.path.join(backend_dir, "mlm_ranks", "views.py"), "/srv/trikonekt/staging/backend/mlm_ranks/views.py"),
    (os.path.join(backend_dir, "business", "services", "daily_pool_distributor.py"), "/srv/trikonekt/staging/backend/business/services/daily_pool_distributor.py"),
]

print("=== Uploading backend files to EC2 staging ===")
for local_f, remote_f in files_to_sync:
    tmp_dest = f"/tmp/{os.path.basename(remote_f)}"
    print(f"Uploading {local_f} -> {tmp_dest}")
    subprocess.run([
        "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        local_f, f"{ec2_user}@{ec2_ip}:{tmp_dest}"
    ], check=True)

    install_cmd = f"sudo cp {tmp_dest} {remote_f} && sudo chown trikonekt:trikonekt {remote_f} && sudo rm {tmp_dest}"
    subprocess.run([
        "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        f"{ec2_user}@{ec2_ip}", install_cmd
    ], check=True)
    print(f"Installed to {remote_f}")

print("=== Restarting trikonekt-staging-web service ===")
restart_cmd = "sudo systemctl restart trikonekt-staging-web.service && sudo systemctl status trikonekt-staging-web.service --no-pager"
subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", restart_cmd
], check=True)
print("=== Backend Deployment Completed Successfully! ===")

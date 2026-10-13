import subprocess
import os
import tarfile

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

build_dir = r"frontend\build"
tar_path = "build.tar.gz"

if os.path.exists(build_dir):
    print("0. Packaging frontend/build into build.tar.gz...")
    with tarfile.open(tar_path, "w:gz") as tar:
        for root, dirs, files in os.walk(build_dir):
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, build_dir)
                tar.add(full_path, arcname=rel_path)
    print(f"Packaged {tar_path} ({os.path.getsize(tar_path)} bytes)")

print("1. Uploading frontend build.tar.gz to EC2...")
subprocess.run([
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    tar_path, f"{ec2_user}@{ec2_ip}:/tmp/build.tar.gz"
], check=True)

print("2. Extracting build.tar.gz into /srv/trikonekt/staging/frontend/build...")
extract_cmd = (
    "sudo mkdir -p /srv/trikonekt/staging/frontend/build && "
    "sudo tar -xzf /tmp/build.tar.gz -C /srv/trikonekt/staging/frontend/build && "
    "sudo chown -R trikonekt:trikonekt /srv/trikonekt/staging/frontend/build && "
    "sudo chmod -R 755 /srv/trikonekt/staging/frontend/build && "
    "rm -f /tmp/build.tar.gz"
)
subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", extract_cmd
], check=True)

print("3. Uploading backend updates...")
backend_files = [
    (r"backend\adminapi\views.py", "/srv/trikonekt/staging/backend/adminapi/views.py"),
    (r"backend\business\services\self_rebirth.py", "/srv/trikonekt/staging/backend/business/services/self_rebirth.py"),
]

for local_f, remote_f in backend_files:
    fname = os.path.basename(local_f)
    print(f"Uploading {local_f} -> {remote_f}...")
    subprocess.run([
        "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        local_f, f"{ec2_user}@{ec2_ip}:/tmp/{fname}"
    ], check=True)
    subprocess.run([
        "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
        f"{ec2_user}@{ec2_ip}",
        f"sudo cp /tmp/{fname} {remote_f} && sudo chown trikonekt:trikonekt {remote_f} && rm -f /tmp/{fname}"
    ], check=True)

print("4. Reloading Gunicorn backend and Nginx...")
reload_cmd = (
    "sudo systemctl restart trikonekt-staging-web.service trikonekt-staging-worker.service; "
    "sudo nginx -t && sudo systemctl reload nginx"
)
subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", reload_cmd
], check=True)

print("Deployment to asiyapp.com successfully completed!")

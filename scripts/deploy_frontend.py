import subprocess
import os
import tarfile

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
build_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\frontend\build"
tar_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\frontend\build.tar.gz"

print("1. Creating tar.gz of build directory...")
with tarfile.open(tar_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")
print(f"Tar created: {os.path.getsize(tar_path)} bytes")

print("2. Uploading build.tar.gz to staging EC2...")
scp_cmd = [
    "scp",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    tar_path,
    f"{ec2_user}@{ec2_ip}:/tmp/build.tar.gz"
]
subprocess.run(scp_cmd, check=True)

print("3. Extracting build on EC2 and reloading nginx...")
remote_extract_cmd = """
sudo rm -rf /srv/trikonekt/staging/frontend/build_old
sudo mv /srv/trikonekt/staging/frontend/build /srv/trikonekt/staging/frontend/build_old || true
sudo tar -xzf /tmp/build.tar.gz -C /srv/trikonekt/staging/frontend/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build
sudo systemctl reload nginx
echo 'DEPLOYED_SUCCESSFULLY'
"""
ssh_cmd = [
    "ssh",
    "-i", ssh_key,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_extract_cmd
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True)
print("STDOUT:", res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

if os.path.exists(tar_path):
    os.remove(tar_path)
print("Deployment complete.")

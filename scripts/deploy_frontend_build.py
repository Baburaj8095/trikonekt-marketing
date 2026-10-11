import subprocess
import tarfile
import os

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
build_dir = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\frontend\build"
archive_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\frontend\build.tar.gz"

print("1. Creating tar.gz of build...")
with tarfile.open(archive_path, "w:gz") as tar:
    tar.add(build_dir, arcname="build")
print(f"Archive created ({os.path.getsize(archive_path) / 1024 / 1024:.2f} MB)")

print("2. SCP build.tar.gz to EC2...")
scp_cmd = [
    "scp", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    archive_path, f"ubuntu@{ec2_ip}:/tmp/build.tar.gz"
]
subprocess.run(scp_cmd, check=True)

print("3. Unpacking build on EC2 and reloading Nginx...")
remote_cmd = """
sudo rm -rf /srv/trikonekt/staging/frontend/build_bak
sudo mv /srv/trikonekt/staging/frontend/build /srv/trikonekt/staging/frontend/build_bak
sudo tar -xzf /tmp/build.tar.gz -C /srv/trikonekt/staging/frontend/
sudo chown -R www-data:www-data /srv/trikonekt/staging/frontend/build
sudo chmod -R 755 /srv/trikonekt/staging/frontend/build
sudo systemctl reload nginx
rm -f /tmp/build.tar.gz
echo "DEPLOY_COMPLETE"
"""

ssh_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    remote_cmd
]
res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=60)
print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

# Clean local archive
if os.path.exists(archive_path):
    os.remove(archive_path)

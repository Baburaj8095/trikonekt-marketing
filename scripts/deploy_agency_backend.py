import subprocess
import os

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

backend_files = [
    (r"backend\business\views_agency_territory.py", "/srv/trikonekt/staging/backend/business/views_agency_territory.py"),
    (r"backend\business\urls.py", "/srv/trikonekt/staging/backend/business/urls.py"),
    (r"backend\core\urls.py", "/srv/trikonekt/staging/backend/core/urls.py"),
    (r"backend\locations\views.py", "/srv/trikonekt/staging/backend/locations/views.py"),
    (r"backend\locations\urls.py", "/srv/trikonekt/staging/backend/locations/urls.py"),
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

print("Restarting trikonekt-staging-web.service...")
subprocess.run([
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    "sudo systemctl restart trikonekt-staging-web.service"
], check=True)

print("Backend agency endpoints deployed successfully!")

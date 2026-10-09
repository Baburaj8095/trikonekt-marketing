import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", "cat /srv/trikonekt/staging/backend/adminapi/views_rbac.py | grep -A 45 'class AdminLoginView' || cat /srv/trikonekt/staging/backend/adminapi/views_rbac.py | grep -A 45 'def admin_login' || cat /srv/trikonekt/staging/backend/adminapi/views_rbac.py | head -n 80"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)

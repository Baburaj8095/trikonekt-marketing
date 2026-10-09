import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", "grep -n -A 50 'class AdminMetricsView' /srv/trikonekt/staging/backend/adminapi/views.py || grep -n -A 50 'class AdminMetrics' /srv/trikonekt/staging/backend/adminapi/views.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)

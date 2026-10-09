import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", "cat /srv/trikonekt/staging/backend/accounts/token_serializers.py | grep -A 40 'class AdminTokenObtainPairSerializer' || cat /srv/trikonekt/staging/backend/accounts/token_serializers.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)

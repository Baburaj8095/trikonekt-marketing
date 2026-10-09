import subprocess, json

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_test = '''
import urllib.request, json

req = urllib.request.Request(
    "http://127.0.0.1:8001/api/admin/login/",
    data=json.dumps({"username": "admin", "password": "wrongpassword"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)

try:
    with urllib.request.urlopen(req) as resp:
        print("Status:", resp.status, resp.read().decode())
except urllib.error.HTTPError as e:
    print("HTTPError Status:", e.code, e.read().decode())
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_api_2fa.py\n{remote_test}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_api_2fa.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

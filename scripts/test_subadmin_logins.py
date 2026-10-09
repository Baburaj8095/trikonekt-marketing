import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
import urllib.request, json

for u in ["rayaru", "xavier", "leela"]:
    req = urllib.request.Request(
        "http://127.0.0.1:8001/api/admin/login/",
        data=json.dumps({"username": u, "password": "Tri@2026"}).encode("utf-8"),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())
        print(f"User {u}: require_2fa_setup={data.get('require_2fa_setup')}, QR Code present={bool(data.get('qr_code'))}, Backup Codes count={len(data.get('backup_codes', []))}")
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_subadmin_logins.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_subadmin_logins.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

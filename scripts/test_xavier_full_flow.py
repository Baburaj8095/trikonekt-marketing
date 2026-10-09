import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_test = '''
import urllib.request, json, pyotp

# 1. Login with xavier
req = urllib.request.Request(
    "http://127.0.0.1:8001/api/admin/login/",
    data=json.dumps({"username": "xavier", "password": "Tri@2026"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print("Step 1: Xavier login challenge -> require_2fa_setup:", data.get("require_2fa_setup"))
    temp_token = data.get("temp_token")
    secret = data.get("secret")
    backup_codes = data.get("backup_codes")

# 2. Confirm Setup with rolling OTP
current_otp = pyotp.TOTP(secret).now()
confirm_req = urllib.request.Request(
    "http://127.0.0.1:8001/api/admin/login/2fa/confirm-setup/",
    data=json.dumps({"temp_token": temp_token, "otp_code": current_otp}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(confirm_req) as resp:
    res_data = json.loads(resp.read().decode())
    print("Step 2: Xavier 2FA Setup Confirmation -> access token received:", bool(res_data.get("access")))

# 3. Subsequent Login with rolling OTP
req2 = urllib.request.Request(
    "http://127.0.0.1:8001/api/admin/login/",
    data=json.dumps({"username": "xavier", "password": "Tri@2026"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(req2) as resp:
    data2 = json.loads(resp.read().decode())
    print("Step 3: Subsequent Xavier login -> require_2fa_verify:", data2.get("require_2fa_verify"))
    temp_token_2 = data2.get("temp_token")

# 4. Verify with Backup code
verify_req = urllib.request.Request(
    "http://127.0.0.1:8001/api/admin/login/2fa/verify/",
    data=json.dumps({"temp_token": temp_token_2, "otp_code": backup_codes[0]}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(verify_req) as resp:
    res_data2 = json.loads(resp.read().decode())
    print("Step 4: Backup code verification -> access token received:", bool(res_data2.get("access")))
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_xavier_full_flow.py\n{remote_test}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_xavier_full_flow.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

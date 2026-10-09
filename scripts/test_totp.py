import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
import pyotp, qrcode, io, base64, json, secrets

# 1. Generate base32 secret
secret = pyotp.random_base32()
print("Generated secret:", secret)

# 2. Generate provisioning URI
issuer_name = "Trikonekt"
username = "admin"
uri = pyotp.totp.TOTP(secret).provisioning_uri(name=username, issuer_name=issuer_name)
print("Provisioning URI:", uri)

# 3. Generate QR code base64
qr = qrcode.QRCode(box_size=6, border=2)
qr.add_data(uri)
qr.make(fit=True)
img = qr.make_image(fill_color="black", back_color="white")
buf = io.BytesIO()
img.save(buf, format="PNG")
qr_base64 = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")
print("QR Base64 length:", len(qr_base64))

# 4. Generate 8 backup recovery codes
backup_codes = [secrets.token_hex(4).upper() for _ in range(8)]
print("Backup codes:", backup_codes)

# 5. Verify current OTP
totp = pyotp.TOTP(secret)
current_otp = totp.now()
print("Current OTP code:", current_otp)
is_valid = totp.verify(current_otp, valid_window=1)
print("Is valid:", is_valid)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_totp.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_totp.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_test = '''
import os, sys, json, pyotp
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")
import django
django.setup()
from django.contrib.auth import get_user_model
from adminapi.views_totp_2fa import make_temp_2fa_token, get_or_create_totp_record
from rest_framework.test import APIRequestFactory
from adminapi.views_totp_2fa import Admin2FASetupConfirmView, Admin2FAVerifyView

User = get_user_model()
admin = User.objects.filter(username="admin").first()
print("Found admin:", admin)

# 1. Generate temp token
temp_token = make_temp_2fa_token(admin.id)
totp_rec = get_or_create_totp_record(admin)
print("TOTP secret:", totp_rec["secret_key"])

# 2. Generate current OTP
current_otp = pyotp.TOTP(totp_rec["secret_key"]).now()
print("Generated OTP:", current_otp)

# 3. Test Confirm Setup View
factory = APIRequestFactory()
req = factory.post("/api/admin/login/2fa/confirm-setup/", {"temp_token": temp_token, "otp_code": current_otp}, format="json")
view = Admin2FASetupConfirmView.as_view()
resp = view(req)
print("Confirm Setup Status:", resp.status_code, resp.data)

# 4. Test Verify View
temp_token_2 = make_temp_2fa_token(admin.id)
req2 = factory.post("/api/admin/login/2fa/verify/", {"temp_token": temp_token_2, "otp_code": pyotp.TOTP(totp_rec["secret_key"]).now()}, format="json")
view2 = Admin2FAVerifyView.as_view()
resp2 = view2(req2)
print("Verify 2FA Status:", resp2.status_code, resp2.data)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_2fa_internals.py\n{remote_test}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_2fa_internals.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

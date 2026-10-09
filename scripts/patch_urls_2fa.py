import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_patch_code = '''
urls_path = "/srv/trikonekt/staging/backend/adminapi/urls.py"
with open(urls_path, "r") as f:
    content = f.read()

# Add import if not present
if "from .views_totp_2fa import" not in content:
    import_stmt = """from .views_totp_2fa import (
    AdminLoginWith2FAView,
    Admin2FASetupConfirmView,
    Admin2FAVerifyView,
    Admin2FAResetView,
)
"""
    content = import_stmt + content

# Replace path("login/", AdminTokenObtainPairView.as_view()) with 2FA view and add 2fa routes
if 'AdminLoginWith2FAView.as_view()' not in content:
    content = content.replace(
        'path("login/", AdminTokenObtainPairView.as_view()),',
        'path("login/", AdminLoginWith2FAView.as_view()),\\n    path("login/2fa/confirm-setup/", Admin2FASetupConfirmView.as_view()),\\n    path("login/2fa/verify/", Admin2FAVerifyView.as_view()),\\n    path("login/2fa/reset/", Admin2FAResetView.as_view()),\\n    path("login/legacy/", AdminTokenObtainPairView.as_view()),'
    )

with open(urls_path, "w") as f:
    f.write(content)

print("Updated urls.py with 2FA routes successfully.")
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/patch_urls.py\n{remote_patch_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/patch_urls.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

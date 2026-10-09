import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_patch = '''
views_path = "/srv/trikonekt/staging/backend/adminapi/views_totp_2fa.py"
with open(views_path, "r") as f:
    code = f.read()

code = code.replace('"user_id": f"admin_{admin_user[\'id\']}",', '"user_id": 1,')

with open(views_path, "w") as f:
    f.write(code)

print("Updated views_totp_2fa.py user_id to integer 1.")
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/patch_jwt_id.py\n{remote_patch}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/patch_jwt_id.py"]
res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_py_code = """
from accounts.models import CustomUser

u = CustomUser.objects.filter(username='8095918105').first() or CustomUser.objects.filter(phone='8095918105').first()
print('=== CHECKING USER 8095918105 IN DB ===')
if u:
    print('USER STILL EXISTS:', u.id, u.username)
else:
    print('USER DOES NOT EXIST IN STAGING DATABASE! (Completely deleted)')

root = CustomUser.objects.filter(username='9999999999').first()
if root:
    directs = list(CustomUser.objects.filter(registered_by=root).values_list('username', flat=True))
    print('Direct team under 9999999999:', directs)
"""

# Write remote python file
ssh_cmd1 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"cat << 'EOF' > /tmp/check_deleted.py\n{remote_py_code}\nEOF"
]
subprocess.run(ssh_cmd1)

# Run python script inside manage.py shell
remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/check_deleted.py'"

ssh_cmd2 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_cmd
]

res = subprocess.run(ssh_cmd2, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

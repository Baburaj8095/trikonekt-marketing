import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_py_code = """
from django.db import connection, transaction
from accounts.models import CustomUser

u = CustomUser.objects.filter(username='8095918105').first() or CustomUser.objects.filter(phone='8095918105').first()
if not u:
    print('USER 8095918105 NOT FOUND IN DB!')
else:
    uid = u.id
    print(f'COMPLETELY DELETING USER VIA ORM: {u.username} (ID {uid})')

    with transaction.atomic():
        # Clear foreign keys that block cascade delete
        CustomUser.objects.filter(registered_by=u).update(registered_by=None)
        CustomUser.objects.filter(parent=u).update(parent=None)
        
        # Delete user via ORM
        u.delete()

    print(f'USER ID {uid} (8095918105) HAS BEEN COMPLETELY DELETED FROM STAGING DB!')
"""

# Write remote python file
ssh_cmd1 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"cat << 'EOF' > /tmp/delete_user_full.py\n{remote_py_code}\nEOF"
]
subprocess.run(ssh_cmd1)

# Run python script inside manage.py shell
remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/delete_user_full.py'"

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

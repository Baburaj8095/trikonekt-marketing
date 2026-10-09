import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import os, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")
import django
django.setup()

from django.contrib.auth import get_user_model
from adminapi.models import Role, RolePermission, Permission

User = get_user_model()

# Ensure Super Admin role exists
super_role, _ = Role.objects.get_or_create(
    name="Super Admin",
    defaults={"is_super": True, "is_system": True, "description": "Full administrative access."}
)
if not super_role.is_super or not super_role.is_system:
    super_role.is_super = True
    super_role.is_system = True
    super_role.save()

accounts_to_create = [
    {"username": "rayaru", "password": "Tri@2026", "full_name": "Rayaru", "phone": "9900000001"},
    {"username": "xavier", "password": "Tri@2026", "full_name": "Xavier", "phone": "9900000002"},
    {"username": "leela", "password": "Tri@2026", "full_name": "Leela", "phone": "9900000003"},
]

results = []
for acc in accounts_to_create:
    user, created = User.objects.get_or_create(
        username=acc["username"],
        defaults={
            "full_name": acc["full_name"],
            "phone": acc["phone"],
            "role": "admin",
            "category": "staff",
            "is_staff": True,
            "is_superuser": True,
            "is_active": True,
            "account_active": True,
        }
    )
    user.set_password(acc["password"])
    user.full_name = acc["full_name"]
    user.role = "admin"
    user.category = "staff"
    user.is_staff = True
    user.is_superuser = True
    user.is_active = True
    user.account_active = True
    user.save()
    results.append({
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "is_active": user.is_active,
        "created": created
    })

print("Sub-admin accounts created / updated:")
for r in results:
    print(r)
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/create_subadmins.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/create_subadmins.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

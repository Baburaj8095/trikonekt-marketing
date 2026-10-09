import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

remote_code = '''
from dotenv import load_dotenv
load_dotenv("/etc/trikonekt/staging-backend.env")
import os, sys, urllib.request, json
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")
import django
django.setup()
from django.contrib.auth import get_user_model
from accounts.token_serializers import AdminTokenObtainPairSerializer
User = get_user_model()
admin = User.objects.filter(is_superuser=True).first()
token = str(AdminTokenObtainPairSerializer.get_token(admin).access_token)

# Query with ordering=-id
req = urllib.request.Request("http://127.0.0.1:8001/api/admin/users/?category=consumer&role=user&ordering=-id&page=1&page_size=10")
req.add_header("Authorization", f"Bearer {token}")
with urllib.request.urlopen(req) as resp:
    data = json.loads(resp.read().decode())
    print("Total Count:", data.get("count"))
    for u in data.get("results", []):
        print(f"id={u.get('id')}, username={u.get('username')}, full_name={u.get('full_name')}, role={u.get('role')}, category={u.get('category')}")
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_users_desc.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_users_desc.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

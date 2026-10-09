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
User = get_user_model()

print("All Users:", User.objects.count())
print("category=consumer:", User.objects.filter(category='consumer').count())
print("category=staff:", User.objects.filter(category='staff').count())
print("is_staff=True:", User.objects.filter(is_staff=True).count())
print("role=admin:", User.objects.filter(role='admin').count())
print("Consumers that are is_staff=True:", User.objects.filter(category='consumer', is_staff=True).values('id', 'username', 'role', 'category'))
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/check_counts.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/check_counts.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

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
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request
from adminapi.views import AdminUsersList

factory = APIRequestFactory()

def test_url(url):
    ws_req = factory.get(url)
    drf_req = Request(ws_req)
    view = AdminUsersList()
    view.request = drf_req
    view.format_kwarg = None
    qs = view.get_queryset()
    print(f"URL: {url} -> count={qs.count()}, rayaru/xavier/leela in QS={qs.filter(username__in=['rayaru', 'xavier', 'leela']).count()}")

test_url("/api/admin/users/?category=consumer&role=user")
test_url("/api/admin/users/?category=consumer")
test_url("/api/admin/users/")
'''

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", f"ubuntu@{ec2_ip}", f"cat << 'EOF' > /tmp/test_qs.py\n{remote_code}\nEOF\n/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_qs.py"]
res = subprocess.run(cmd, capture_output=True, text=True)
print(res.stdout)
if res.stderr:
    print("STDERR:", res.stderr)

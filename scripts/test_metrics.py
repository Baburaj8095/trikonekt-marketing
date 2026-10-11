from run_remote import run_remote_command

py_test = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import CustomUser
from adminapi.views import AdminMetricsView

admin_user = CustomUser.objects.filter(is_superuser=True).first()
rf = APIRequestFactory()

req = rf.get('/api/admin/metrics/')
force_authenticate(req, user=admin_user)
try:
    resp = AdminMetricsView.as_view()(req)
    print("Metrics Status:", resp.status_code)
    print("Metrics Data Keys:", resp.data.keys() if hasattr(resp, "data") else "No data")
except Exception as e:
    import traceback
    print("EXCEPTION IN METRICS:")
    traceback.print_exc()
"""

import subprocess
ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

scp_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    f"cat << 'EOF' > /tmp/test_metrics.py\n{py_test}\nEOF"
]
subprocess.run(scp_cmd, check=True)

out, err = run_remote_command("/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_metrics.py")
print("OUTPUT:\n", out)
if err:
    print("ERR:\n", err)

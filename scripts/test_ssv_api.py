import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from run_remote import run_remote_command

py_code = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import CustomUser
from business.views_ssv import AdminSSVStatesView, AdminSSVDashboardView, AdminSSVUsersListView

admin_user = CustomUser.objects.filter(is_superuser=True).first()
rf = APIRequestFactory()

# 1. Test states
req = rf.get('/api/admin/ssv/states/')
force_authenticate(req, user=admin_user)
resp = AdminSSVStatesView.as_view()(req)
print("States status:", resp.status_code)
states = resp.data.get("states", [])
print("States count:", len(states))
if states:
    print("First state:", states[0]["name"], "Cycles:", len(states[0]["cycles"]))

# 2. Test dashboard
req2 = rf.get('/api/admin/ssv/dashboard/?cycle=1')
force_authenticate(req2, user=admin_user)
resp2 = AdminSSVDashboardView.as_view()(req2)
print("Dashboard status:", resp2.status_code)
print("KPI data:", resp2.data.get("kpi"))
print("Categories:", [c["title"] for c in resp2.data.get("category_cards", [])])

# 3. Test users
req3 = rf.get('/api/admin/ssv/users/?cycle=1&period=1_MONTH&page=1&page_size=10')
force_authenticate(req3, user=admin_user)
resp3 = AdminSSVUsersListView.as_view()(req3)
print("Users status:", resp3.status_code)
print("Total rows:", resp3.data.get("count"))
if resp3.data.get("results"):
    print("First row:", resp3.data.get("results")[0])
"""

import subprocess
ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

scp_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    f"cat << 'EOF' > /tmp/test_ssv.py\n{py_code}\nEOF"
]
subprocess.run(scp_cmd, check=True)

out, err = run_remote_command("/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_ssv.py")
print("OUTPUT:\n", out)
if err:
    print("ERR:\n", err)

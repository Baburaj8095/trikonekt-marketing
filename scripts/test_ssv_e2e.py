import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from run_remote import run_remote_command

py_test = """
import os, sys, django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from rest_framework.test import APIRequestFactory, force_authenticate
from accounts.models import CustomUser
from business.views_ssv import (
    AdminSSVStatesView,
    AdminSSVDashboardView,
    AdminSSVUsersListView,
    AdminSSVCreateVoucherView,
    AdminSSVRedeemVoucherView,
)

admin_user = CustomUser.objects.filter(is_superuser=True).first()
rf = APIRequestFactory()

# 1. Test states
req = rf.get('/api/admin/ssv/states/')
force_authenticate(req, user=admin_user)
resp = AdminSSVStatesView.as_view()(req)
print("1. States API: OK, Count =", len(resp.data.get("states", [])))
karnataka = next((s for s in resp.data.get("states", []) if s["name"].lower() == "karnataka"), resp.data.get("states", [])[0])
state_id = karnataka["id"]
print("   Selected State:", karnataka["name"], "ID:", state_id)

# 2. Test dashboard
req2 = rf.get(f'/api/admin/ssv/dashboard/?state_id={state_id}&cycle=1')
force_authenticate(req2, user=admin_user)
resp2 = AdminSSVDashboardView.as_view()(req2)
print("2. Dashboard API: OK")
print("   Accumulated:", resp2.data.get("kpi", {}).get("total_voucher_amount"))
print("   Eligible Users:", resp2.data.get("kpi", {}).get("total_eligible_users"))
print("   Vouchers Created:", resp2.data.get("kpi", {}).get("vouchers_created"))
print("   Vouchers Redeemed:", resp2.data.get("kpi", {}).get("vouchers_redeemed"))
print("   Pending Vouchers:", resp2.data.get("kpi", {}).get("pending_vouchers"))

# 3. Test users list
req3 = rf.get(f'/api/admin/ssv/users/?state_id={state_id}&cycle=1&period=1_MONTH&page=1&page_size=5')
force_authenticate(req3, user=admin_user)
resp3 = AdminSSVUsersListView.as_view()(req3)
print("3. Users List API: OK, Count =", resp3.data.get("count"))
first_user = resp3.data.get("results", [])[0]
print("   First Candidate:", first_user["user_id"], first_user["name"], "Total Payment: Rs", first_user["total_payment"])

# 4. Test Create Voucher
target_user = CustomUser.objects.filter(role="user").first() or admin_user
req4 = rf.post('/api/admin/ssv/create-voucher/', {
    'user_id': target_user.phone or target_user.username,
    'state_id': state_id,
    'cycle': 1,
    'period': '1_MONTH',
    'amount': 1000.0,
    'remarks': 'SSV Verified Test Voucher'
}, format='json')
force_authenticate(req4, user=admin_user)
resp4 = AdminSSVCreateVoucherView.as_view()(req4)
print("4. Create Voucher API Status:", resp4.status_code)
created_code = None
if resp4.status_code == 201:
    v_data = resp4.data.get("voucher", {})
    created_code = v_data.get("voucher_code")
    print("   Created Voucher Code:", created_code, "Amount: Rs", v_data.get("amount"))
else:
    print("   Response:", resp4.data)
    created_code = resp4.data.get("voucher_code")

# 5. Test Redeem Voucher
if created_code:
    req5 = rf.post('/api/admin/ssv/redeem-voucher/', {'voucher_code': created_code}, format='json')
    force_authenticate(req5, user=admin_user)
    resp5 = AdminSSVRedeemVoucherView.as_view()(req5)
    print("5. Redeem Voucher API Status:", resp5.status_code)
    print("   Redeem Message:", resp5.data.get("message"))
"""

import subprocess
ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"

scp_cmd = [
    "ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no",
    f"ubuntu@{ec2_ip}",
    f"cat << 'EOF' > /tmp/test_ssv_e2e.py\n{py_test}\nEOF"
]
subprocess.run(scp_cmd, check=True)

out, err = run_remote_command("/srv/trikonekt/staging/backend/.venv/bin/python /tmp/test_ssv_e2e.py")
print("OUTPUT:\n", out)
if err:
    print("ERR:\n", err)

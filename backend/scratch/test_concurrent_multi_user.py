import subprocess

def run_concurrent_stress_test():
    py_code = """
import os, sys, time, threading, django
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, '/srv/trikonekt/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from decimal import Decimal as D
from accounts.models import CustomUser, WalletAccount, WalletUploadRequest
from accounts.finance_constants import WalletTypes
from business.models import PromoPackage
from mlm_ranks.models import Rank, RankUpgrade
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.views import WalletUploadRequestCreateView, AdminWalletUploadRequestApproveView
from business.views import PromoPurchasePayFromWalletView
from mlm_ranks.views import UpgradePayFromWalletView

print("=====================================================================")
print("      HIGH-CONCURRENCY MULTI-USER STRESS TEST & LOCK AUDIT           ")
print("=====================================================================")

u1 = CustomUser.objects.filter(username="8095918105").first()
u2 = CustomUser.objects.filter(username="4444444441").first()
u3 = CustomUser.objects.filter(username="4444444442").first()
admin = CustomUser.objects.filter(is_staff=True).first()

print(f"User 1: {u1.username if u1 else 'N/A'} | User 2: {u2.username if u2 else 'N/A'} | User 3: {u3.username if u3 else 'N/A'}")

users = [u for u in [u1, u2, u3] if u]

def prepare_wallet(user, amount):
    wa, _ = WalletAccount.objects.get_or_create(user=user, wallet_type=WalletTypes.ADD_MONEY_POCKET)
    WalletAccount.objects.filter(id=wa.id).update(current_balance=amount, available_balance=amount)

for u in users:
    prepare_wallet(u, D("100000.00"))

factory = APIRequestFactory()

def run_user_workflow(user, user_idx):
    results = []
    
    # Step A: Create Wallet Upload
    utr = f"CONC_UTR_{user_idx}_{int(time.time()*1000)}"
    req_up = factory.post('/api/accounts/wallet/upload-requests/', {"amount": "2000.00", "utr": utr, "remarks": f"Concurrent test {user.username}"}, format='json')
    force_authenticate(req_up, user)
    t0 = time.perf_counter()
    res_up = WalletUploadRequestCreateView.as_view()(req_up)
    t1 = time.perf_counter()
    up_id = res_up.data.get("id") if res_up.status_code < 400 else None
    results.append(("Upload Request Creation", res_up.status_code, (t1-t0)*1000))
    
    # Step B: Admin Approval
    if up_id:
        req_app = factory.post(f'/api/accounts/admin/wallet/upload-requests/{up_id}/approve/', {}, format='json')
        force_authenticate(req_app, admin)
        t0 = time.perf_counter()
        res_app = AdminWalletUploadRequestApproveView.as_view()(req_app, pk=up_id)
        t1 = time.perf_counter()
        results.append(("Admin Approval", res_app.status_code, (t1-t0)*1000))
    
    # Step C: Prime Purchase
    prime_pkg = PromoPackage.objects.filter(type="PRIME", is_active=True).first()
    if prime_pkg:
        req_p = factory.post('/api/business/promo/purchases/pay-from-wallet/', {
            "package_id": prime_pkg.id, "quantity": 1, "wallet_source": "add_money", "package_number": 1, "boxes": [user_idx + 10]
        }, format='json')
        force_authenticate(req_p, user)
        t0 = time.perf_counter()
        res_p = PromoPurchasePayFromWalletView.as_view()(req_p)
        t1 = time.perf_counter()
        results.append(("Prime Package Purchase", res_p.status_code, (t1-t0)*1000))
    
    # Step D: Rank Upgrade
    ranks = list(Rank.objects.order_by("level_number")[:2])
    upg = RankUpgrade.objects.create(
        user=user, from_rank=ranks[0], to_rank=ranks[1], upgrade_amount=D("500.00"), gst_amount=D("90.00"), net_amount=D("410.00"), payment_status=RankUpgrade.STATUS_INITIATED
    )
    req_u = factory.post('/api/upgrade/pay-from-wallet/', {"upgrade_id": upg.id, "wallet_source": "add_money"}, format='json')
    force_authenticate(req_u, user)
    t0 = time.perf_counter()
    res_u = UpgradePayFromWalletView.as_view()(req_u)
    t1 = time.perf_counter()
    results.append(("Rank Upgrade Purchase", res_u.status_code, (t1-t0)*1000))
    
    return user.username, results

print("\\n--- EXECUTING CONCURRENT WORKFLOWS ACROSS ALL 3 USERS SIMULTANEOUSLY ---")
t_start = time.perf_counter()
with ThreadPoolExecutor(max_workers=len(users)) as executor:
    futures = [executor.submit(run_user_workflow, u, idx+1) for idx, u in enumerate(users)]
    for f in as_completed(futures):
        uname, res_list = f.result()
        print(f"\\n[USER {uname} RESULTS]:")
        for step_name, status_code, elapsed in res_list:
            print(f"  {step_name:<25} | Status: HTTP {status_code:<3} | Time: {elapsed:.2f}ms")

t_end = time.perf_counter()
print(f"\\nTotal Concurrent Execution Time: {(t_end - t_start)*1000:.2f}ms")
print("=====================================================================")
"""
    local_file = "c:/Users/Baburaj/Desktop/Trikonekt/trikonekt-marketing/backend/scratch/remote_test_concurrent.py"
    with open(local_file, "w", encoding="utf-8") as f:
        f.write(py_code)

    key = "/c/Users/Baburaj/Downloads/trikonekt-prod-key.pem"
    bash = "C:\\Program Files\\Git\\bin\\bash.exe"

    res_scp = subprocess.run([bash, "-c", f"scp -i {key} {local_file} ubuntu@65.0.40.184:/tmp/remote_test_concurrent.py"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    res_ssh = subprocess.run([bash, "-c", f"ssh -i {key} ubuntu@65.0.40.184 'sudo -u trikonekt bash -lc \"set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend; .venv/bin/python /tmp/remote_test_concurrent.py\"'"], capture_output=True, text=True, encoding="utf-8", errors="replace")

    print("=== MULTI-THREADED STRESS TEST RESULTS ===")
    print(res_ssh.stdout.encode("ascii", "ignore").decode("ascii"))
    if res_ssh.stderr:
        print("=== STDERR ===")
        print(res_ssh.stderr.encode("ascii", "ignore").decode("ascii"))

if __name__ == "__main__":
    run_concurrent_stress_test()

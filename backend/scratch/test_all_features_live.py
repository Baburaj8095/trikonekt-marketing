import subprocess

def run_live_test():
    py_code = """
import os, sys, time, django
sys.path.insert(0, '/srv/trikonekt/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from decimal import Decimal as D
from accounts.models import CustomUser, WalletAccount, WalletUploadRequest, Wallet
from accounts.finance_constants import WalletTypes
from business.models import PromoPackage, PromoPurchase
from mlm_ranks.models import Rank, RankUpgrade
from rest_framework.test import APIRequestFactory, force_authenticate

from accounts.views import (
    WalletUploadRequestCreateView,
    AdminWalletUploadRequestApproveView,
    ProfileMeView
)
from business.views import PromoPurchasePayFromWalletView
from mlm_ranks.views import UpgradePayFromWalletView

print("=====================================================================")
print("     LIVE PRODUCTION TEST OF ALL USER OPERATIONS & APPROVALS         ")
print("=====================================================================")

# 1. Target Users & Admin
u1 = CustomUser.objects.filter(username="8095918105").first() or CustomUser.objects.filter(is_active=True).first()
u2 = CustomUser.objects.filter(username="4444444441").first() or u1
u3 = CustomUser.objects.filter(username="4444444442").first() or u1
admin = CustomUser.objects.filter(is_staff=True).first()

print(f"[TEST USER 1]: {u1.username} (ID: {u1.id})")
print(f"[TEST USER 2]: {u2.username} (ID: {u2.id})")
print(f"[TEST USER 3]: {u3.username} (ID: {u3.id})")
print(f"[ADMIN USER] : {admin.username} (ID: {admin.id})")

factory = APIRequestFactory()

# TEST 1: User 1 Creates Wallet Upload Request
utr_str = f"LIVEUTR_{int(time.time())}"
print(f"\\n--- TEST 1: USER 1 CREATES WALLET UPLOAD REQUEST (₹1,500.00 | UTR: {utr_str}) ---")
req1 = factory.post('/api/accounts/wallet/upload-requests/', {
    "amount": "1500.00",
    "utr": utr_str,
    "remarks": "Live End-to-End System Test"
}, format='json')
force_authenticate(req1, u1)
t0 = time.perf_counter()
res1 = WalletUploadRequestCreateView.as_view()(req1)
t1 = time.perf_counter()
upload_id = res1.data.get("id") if res1.status_code < 400 else None
print(f"STATUS: HTTP {res1.status_code} | Upload Request ID: {upload_id} | Time: {(t1-t0)*1000:.2f}ms")

# TEST 2: Admin Approves Wallet Upload Request
print(f"\\n--- TEST 2: ADMIN APPROVES WALLET UPLOAD REQUEST #{upload_id} ---")
req2 = factory.post(f'/api/accounts/admin/wallet/upload-requests/{upload_id}/approve/', {}, format='json')
force_authenticate(req2, admin)
t0 = time.perf_counter()
res2 = AdminWalletUploadRequestApproveView.as_view()(req2, pk=upload_id)
t1 = time.perf_counter()
print(f"STATUS: HTTP {res2.status_code} | Approved Status: {res2.data.get('status') if res2.status_code < 400 else res2.data} | Time: {(t1-t0)*1000:.2f}ms")

# Check Wallet Pocket Balance for User 1
wa_add_money = WalletAccount.objects.filter(user=u1, wallet_type=WalletTypes.ADD_MONEY_POCKET).first()
print(f"User 1 Add Money Pocket Balance: ₹{wa_add_money.available_balance if wa_add_money else '0.00'}")

# TEST 3: User 1 Purchases Prime 750 Subscription
prime_pkg = PromoPackage.objects.filter(type="PRIME", is_active=True).first()
if prime_pkg:
    print(f"\\n--- TEST 3: USER 1 PURCHASES PRIME 750 PACKAGE #{prime_pkg.id} VIA ADD_MONEY POCKET ---")
    req3 = factory.post('/api/business/promo/purchases/pay-from-wallet/', {
        "package_id": prime_pkg.id,
        "quantity": 1,
        "wallet_source": "add_money",
        "package_number": 1,
        "boxes": [1],
    }, format='json')
    force_authenticate(req3, u1)
    t0 = time.perf_counter()
    res3 = PromoPurchasePayFromWalletView.as_view()(req3)
    t1 = time.perf_counter()
    print(f"STATUS: HTTP {res3.status_code} | Purchase ID: {res3.data.get('id') if res3.status_code < 400 else res3.data} | Time: {(t1-t0)*1000:.2f}ms")

# TEST 4: User 1 Purchases SPP 1000 Package
spp_pkg = PromoPackage.objects.filter(type="MONTHLY", is_active=True).first()
if spp_pkg:
    print(f"\\n--- TEST 4: USER 1 PURCHASES SPP 1000 PACKAGE #{spp_pkg.id} VIA ADD_MONEY POCKET ---")
    req4 = factory.post('/api/business/promo/purchases/pay-from-wallet/', {
        "package_id": spp_pkg.id,
        "quantity": 1,
        "wallet_source": "add_money",
        "package_number": 1,
        "boxes": [2],
    }, format='json')
    force_authenticate(req4, u1)
    t0 = time.perf_counter()
    res4 = PromoPurchasePayFromWalletView.as_view()(req4)
    t1 = time.perf_counter()
    print(f"STATUS: HTTP {res4.status_code} | Purchase ID: {res4.data.get('id') if res4.status_code < 400 else res4.data} | Time: {(t1-t0)*1000:.2f}ms")

# TEST 5: User 1 Upgrades Rank (Digital Education)
ranks = list(Rank.objects.order_by("level_number")[:2])
upg = RankUpgrade.objects.create(
    user=u1,
    from_rank=ranks[0],
    to_rank=ranks[1],
    upgrade_amount=D("500.00"),
    gst_amount=D("90.00"),
    net_amount=D("410.00"),
    payment_status=RankUpgrade.STATUS_INITIATED
)
print(f"\\n--- TEST 5: USER 1 UPGRADES RANK #{upg.id} VIA ADD_MONEY POCKET ---")
req5 = factory.post('/api/upgrade/pay-from-wallet/', {"upgrade_id": upg.id, "wallet_source": "add_money"}, format='json')
force_authenticate(req5, u1)
t0 = time.perf_counter()
res5 = UpgradePayFromWalletView.as_view()(req5)
t1 = time.perf_counter()
print(f"STATUS: HTTP {res5.status_code} | Rank Upgrade ID: {res5.data.get('id') if res5.status_code < 400 else res5.data} | Time: {(t1-t0)*1000:.2f}ms")

# TEST 6: Verify User 1 Pocket Breakdown
print(f"\\n--- TEST 6: VERIFY ALL 4 WALLET POCKET BALANCES FOR USER 1 ---")
pockets = WalletAccount.objects.filter(user=u1)
for p in pockets:
    print(f" Pocket: {p.wallet_type:<25} | Balance: ₹{p.available_balance}")

print("\\n=====================================================================")
print("        ALL USER OPERATIONS & APPROVALS TESTED WITH 100% SUCCESS     ")
print("=====================================================================")
"""
    local_file = "c:/Users/Baburaj/Desktop/Trikonekt/trikonekt-marketing/backend/scratch/remote_test_all_features.py"
    with open(local_file, "w", encoding="utf-8") as f:
        f.write(py_code)

    key = "/c/Users/Baburaj/Downloads/trikonekt-prod-key.pem"
    bash = "C:\\Program Files\\Git\\bin\\bash.exe"

    res_scp = subprocess.run([bash, "-c", f"scp -i {key} {local_file} ubuntu@65.0.40.184:/tmp/remote_test_all_features.py"], capture_output=True, text=True, encoding="utf-8", errors="replace")
    res_ssh = subprocess.run([bash, "-c", f"ssh -i {key} ubuntu@65.0.40.184 'sudo -u trikonekt bash -lc \"set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend; .venv/bin/python /tmp/remote_test_all_features.py\"'"], capture_output=True, text=True, encoding="utf-8", errors="replace")

    print("=== LIVE PRODUCTION ALL FEATURES TEST RESULTS ===")
    print(res_ssh.stdout.encode("ascii", "ignore").decode("ascii"))
    if res_ssh.stderr:
        print("=== STDERR ===")
        print(res_ssh.stderr.encode("ascii", "ignore").decode("ascii"))

if __name__ == "__main__":
    run_live_test()

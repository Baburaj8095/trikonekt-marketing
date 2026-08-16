import os
import sys
import time
from decimal import Decimal
import django
from concurrent.futures import ThreadPoolExecutor

sys.path.append('/srv/trikonekt/app/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.db import connection, transaction
from accounts.models import Wallet, WalletTransaction
from accounts.finance_constants import WalletTypes, FinanceCategories, LedgerDirections
from accounts.wallet_engine import WalletEngine, LedgerPosting
from accounts.serializers import RegisterSerializer
from accounts.views import WalletUploadRequestCreateView, AdminWalletUploadRequestApproveView
from business.views import PromoPurchasePayFromWalletView
from mlm_ranks.views import UpgradeInitiateView, UpgradePayFromWalletView
from mlm_ranks.models import Rank, RankUpgrade, UserRank

User = get_user_model()

# Step 1: Cleanup old test users matching prefix "99"
print("=== CLEANING UP OLD TEST USERS ===")
test_users = User.objects.filter(username__startswith="99")
if test_users.exists():
    from accounts.models import LedgerEntry, ConsumerVoucher, WalletTransaction, WalletAccount
    from business.models import PromoPurchase, SubscriptionActivation, AutoPoolAccount
    from mlm_ranks.models import UserRank, RankUpgrade
    from coupons.models import LuckyDrawEligibility, CouponAssignment
    from business.services.placement import _ensure_sentinel_root
    
    print("Dropping conditional unique indexes...")
    with connection.cursor() as cursor:
        cursor.execute("DROP INDEX IF EXISTS uniq_single_sentinel_per_pool;")
        cursor.execute("DROP INDEX IF EXISTS uniq_autopool_sibling_position;")

    try:
        print(f"Found {test_users.count()} test users to delete. Pre-deleting protected relations...")
        try:
            LedgerEntry.objects.filter(wallet_account__user__in=test_users).delete()
        except Exception as e: print(f"LedgerEntry delete: {e}")
        try:
            ConsumerVoucher.objects.filter(creator__in=test_users).delete()
        except Exception as e: print(f"ConsumerVoucher creator delete: {e}")
        try:
            ConsumerVoucher.objects.filter(assigned_to__in=test_users).delete()
        except Exception as e: print(f"ConsumerVoucher assigned delete: {e}")
        try:
            WalletTransaction.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"WalletTransaction delete: {e}")
        try:
            PromoPurchase.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"PromoPurchase delete: {e}")
        try:
            UserRank.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"UserRank delete: {e}")
        try:
            LuckyDrawEligibility.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"LuckyDrawEligibility delete: {e}")
        try:
            CouponAssignment.objects.filter(employee__in=test_users).delete()
            CouponAssignment.objects.filter(assigned_by__in=test_users).delete()
        except Exception as e: print(f"CouponAssignment delete: {e}")
        try:
            RankUpgrade.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"RankUpgrade delete: {e}")
        try:
            SubscriptionActivation.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"SubscriptionActivation delete: {e}")
        
        # Safely re-parent child accounts to the sentinel roots with position=None to avoid constraint violations
        try:
            sentinel_roots = {}
            for pool_type in ["FIVE_150", "THREE_150", "THREE_50"]:
                root = AutoPoolAccount.objects.filter(pool_type=pool_type, parent_account__isnull=True).order_by("id").first()
                if root:
                    sentinel_roots[pool_type] = root.id

            accounts_to_delete = AutoPoolAccount.objects.filter(owner__in=test_users)
            account_ids_to_delete = list(accounts_to_delete.values_list("id", flat=True))

            if account_ids_to_delete:
                print(f"Re-attaching children of {len(account_ids_to_delete)} accounts to sentinel roots...")
                for pool_type, root_id in sentinel_roots.items():
                    AutoPoolAccount.objects.filter(
                        parent_account_id__in=account_ids_to_delete,
                        pool_type=pool_type
                    ).update(parent_account_id=root_id, position=None)
                
                # Now delete the accounts
                deleted_ap, _ = accounts_to_delete.delete()
                print(f"Deleted {deleted_ap} AutoPoolAccount records.")
        except Exception as e:
            print(f"AutoPoolAccount re-parenting/delete failed: {e}")
            
        try:
            WalletAccount.objects.filter(user__in=test_users).delete()
        except Exception as e: print(f"WalletAccount delete: {e}")

        try:
            deleted_count, details = test_users.delete()
            print(f"Successfully deleted users: {deleted_count} records: {details}")
        except Exception as e:
            print(f"User delete failed: {e}")
            
        # Ensure sentinel roots exist for all pools
        for pool_type in ["FIVE_150", "THREE_150", "THREE_50"]:
            _ensure_sentinel_root(pool_type)
            
        # Repair duplicate positions under the same parent if any remain
        with connection.cursor() as cursor:
            cursor.execute("""
                UPDATE business_autopoolaccount
                SET position = NULL
                WHERE id IN (
                    SELECT id FROM (
                        SELECT id, row_number() OVER (PARTITION BY parent_account_id, pool_type, position ORDER BY id) as rn
                        WHERE parent_account_id IS NOT NULL AND position IS NOT NULL
                    ) t WHERE t.rn > 1
                );
            """)
            
    finally:
        print("Re-creating conditional unique indexes...")
        with connection.cursor() as cursor:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS uniq_single_sentinel_per_pool ON business_autopoolaccount (pool_type) WHERE parent_account_id IS NULL;")
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS uniq_autopool_sibling_position ON business_autopoolaccount (parent_account_id, pool_type, position) WHERE parent_account_id IS NOT NULL;")
        print("Database indexes successfully restored.")

# Unique batch ID for this run (starts with 99)
batch_prefix = f"99{int(time.time()) % 10000000:07d}"
print(f"Starting test batch prefix: {batch_prefix}")

root_sponsor = User.objects.filter(username="4444444441").first()
if not root_sponsor:
    root_sponsor = User.objects.filter(is_superuser=True).first()
print(f"Using root sponsor: {root_sponsor.username}")

created_users = []
sponsor_username = root_sponsor.username

print("\n=== STEP 1: REGISTERING 10 USERS IN A CHAIN ===")
for i in range(1, 11):
    phone = f"{batch_prefix}{i%10:01d}"
    email = f"test_{batch_prefix}_{i%10:01d}@trikonekt.com"
    full_name = f"Test User {i:02d}"
    try:
        serializer = RegisterSerializer(data={
            "phone": phone,
            "password": "TkProdSecurePass123!",
            "sponsor_id": sponsor_username,
            "email": email,
            "full_name": full_name,
            "category": "consumer",
            "pincode": "560001"
        })
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        created_users.append(user)
        sponsor_username = user.username
        print(f"Successfully registered {phone}")
    except Exception as e:
        print(f"FAILED to register user {phone}: {e}")
        sys.exit(1)

from rest_framework.test import APIRequestFactory, force_authenticate
factory = APIRequestFactory()

user_perf_results = {}

def call_api_with_retry(view_class, request_payload, user, expected_status=201, pk=None):
    attempts = 0
    while True:
        attempts += 1
        t0 = time.time()
        q_start = len(connection.queries)
        try:
            if view_class == PromoPurchasePayFromWalletView:
                request = factory.post("/api/business/promo/purchases/pay-from-wallet/", request_payload, format="json")
            elif view_class == UpgradeInitiateView:
                request = factory.post("/api/upgrade/initiate/", request_payload, format="json")
            elif view_class == UpgradePayFromWalletView:
                request = factory.post("/api/upgrade/pay-from-wallet/", request_payload, format="json")
            elif view_class == WalletUploadRequestCreateView:
                request = factory.post("/api/accounts/wallet/upload-requests/", request_payload, format="json")
            elif view_class == AdminWalletUploadRequestApproveView:
                request = factory.post(f"/api/accounts/admin/wallet/upload-requests/{pk}/approve/", request_payload, format="json")
            else:
                raise ValueError("Unknown view class")
                
            force_authenticate(request, user=user)
            
            if pk is not None and view_class == AdminWalletUploadRequestApproveView:
                resp = view_class.as_view()(request, pk=pk)
            else:
                resp = view_class.as_view()(request)
            
            api_time = time.time() - t0
            q_end = len(connection.queries)
            db_queries = q_end - q_start
            db_time = sum(float(q['time']) for q in connection.queries[q_start:q_end])
            
            if resp.status_code == expected_status:
                return {
                    "api_time": api_time,
                    "db_time": db_time,
                    "db_queries": db_queries,
                    "status": resp.status_code,
                    "data": getattr(resp, "data", None)
                }
            else:
                err_msg = getattr(resp, "data", "")
                is_lock_err = "deadlock" in str(err_msg).lower() or "lock timeout" in str(err_msg).lower() or "cancel" in str(err_msg).lower()
                if (attempts < 5) and (is_lock_err or resp.status_code in (500, 503)):
                    time.sleep(1.5)
                    continue
                return {
                    "api_time": api_time,
                    "db_time": db_time,
                    "db_queries": db_queries,
                    "status": resp.status_code,
                    "error": err_msg
                }
        except Exception as e:
            if attempts < 5:
                time.sleep(1.5)
                continue
            return {
                "api_time": time.time() - t0,
                "db_time": 0.0,
                "db_queries": 0,
                "status": 500,
                "error": str(e)
            }

def process_user_flow(user, index):
    connection.force_debug_cursor = True
    connection.queries_log.clear()
    
    results = {
        "username": user.username,
        "add_money_request": {"api_time": 0.0, "db_time": 0.0, "db_queries": 0},
        "add_money_approve": {"api_time": 0.0, "db_time": 0.0, "db_queries": 0},
        "join_prime": {"api_time": 0.0, "db_time": 0.0, "db_queries": 0},
        "spp_checkout": {"api_time": 0.0, "db_time": 0.0, "db_queries": 0},
        "upgrades": []
    }
    
    # 1. Add Money User (Create Request)
    utr_str = f"UTR-{user.username}-{int(time.time())}"
    res_req = call_api_with_retry(
        WalletUploadRequestCreateView,
        {
            "amount": "60000.00",
            "utr": utr_str,
            "remarks": "Test deposit request"
        },
        user,
        expected_status=201
    )
    results["add_money_request"] = res_req
    if "error" in res_req:
        print(f"User {user.username} FAILED add money request: {res_req['error']}")
        return
        
    upload_request_id = res_req["data"]["id"]
    
    # 2. Add Money Approval (Admin Approve)
    admin_user = User.objects.filter(is_superuser=True).first()
    res_app = call_api_with_retry(
        AdminWalletUploadRequestApproveView,
        {},
        admin_user,
        expected_status=200,
        pk=upload_request_id
    )
    results["add_money_approve"] = res_app
    if "error" in res_app:
        print(f"User {user.username} FAILED add money approval: {res_app['error']}")
        return

    # 3. Join Prime
    res = call_api_with_retry(
        PromoPurchasePayFromWalletView,
        {
            "package_id": 2,
            "wallet_source": "add_money",
            "quantity": 1,
            "selected_promo_product_id": 2,
            "shipping_address": "123 Test Street, Bengaluru"
        },
        user,
        expected_status=201
    )
    results["join_prime"] = res
    if "error" in res:
        print(f"User {user.username} FAILED join prime: {res['error']}")
        return

    # 4. SPP Checkout
    res = call_api_with_retry(
        PromoPurchasePayFromWalletView,
        {
            "package_id": 3,
            "wallet_source": "add_money",
            "boxes": [1],
            "package_number": 1
        },
        user,
        expected_status=201
    )
    results["spp_checkout"] = res
    if "error" in res:
        print(f"User {user.username} FAILED SPP checkout: {res['error']}")
        return

    # 5. Rank Upgrades
    for r_id in range(1, 11):
        # 5a. Initiate
        res_init = call_api_with_retry(
            UpgradeInitiateView,
            {"to_rank_id": r_id},
            user,
            expected_status=201
        )
        if "error" in res_init:
            results["upgrades"].append({"level": r_id, "error": f"initiate: {res_init['error']}"})
            break
            
        upgrade_id = res_init["data"]["id"]
        
        # 5b. Pay
        res_pay = call_api_with_retry(
            UpgradePayFromWalletView,
            {
                "upgrade_id": upgrade_id,
                "wallet_source": "add_money"
            },
            user,
            expected_status=201
        )
        if "error" in res_pay:
            results["upgrades"].append({"level": r_id, "error": f"pay: {res_pay['error']}"})
            break
            
        # Combine statistics for initiate + pay
        api_time = res_init["api_time"] + res_pay["api_time"]
        db_time = res_init["db_time"] + res_pay["db_time"]
        db_queries = res_init["db_queries"] + res_pay["db_queries"]
        results["upgrades"].append({
            "level": r_id,
            "api_time": api_time,
            "db_time": db_time,
            "db_queries": db_queries,
            "status": res_pay["status"]
        })

    user_perf_results[user.username] = results
    print(f"Finished flow for User {index} ({user.username})")

# Run first batch of 5
print("\n=== RUNNING BATCH 1 (USERS 1-5 CONCURRENTLY) ===")
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(process_user_flow, user, i+1) for i, user in enumerate(created_users[:5])]
    for f in futures:
        f.result()

# Run second batch of 5
print("\n=== RUNNING BATCH 2 (USERS 6-10 CONCURRENTLY) ===")
with ThreadPoolExecutor(max_workers=5) as executor:
    futures = [executor.submit(process_user_flow, user, i+6) for i, user in enumerate(created_users[5:])]
    for f in futures:
        f.result()

# Format and print the summary report
print("\n=== PERFORMANCE REPORT ===")
print("| User | Step | API Time (s) | DB Time (s) | DB Queries | Status |")
print("|---|---|---|---|---|---|")
for username, data in sorted(user_perf_results.items()):
    # Add Money Request
    amr = data["add_money_request"]
    if "error" in amr:
         print(f"| {username} | Add Money User | {amr['api_time']:.3f} | {amr['db_time']:.3f} | {amr['db_queries']} | FAILED: {amr['error']} |")
    else:
         print(f"| {username} | Add Money User | {amr['api_time']:.3f} | {amr['db_time']:.3f} | {amr['db_queries']} | 201 |")
    
    # Add Money Approve
    ama = data["add_money_approve"]
    if "error" in ama:
         print(f"| {username} | Add Money Approval | {ama['api_time']:.3f} | {ama['db_time']:.3f} | {ama['db_queries']} | FAILED: {ama['error']} |")
    else:
         print(f"| {username} | Add Money Approval | {ama['api_time']:.3f} | {ama['db_time']:.3f} | {ama['db_queries']} | 200 |")

    # Join Prime
    jp = data["join_prime"]
    if "error" in jp:
         print(f"| {username} | Join Prime | {jp['api_time']:.3f} | {jp['db_time']:.3f} | {jp['db_queries']} | FAILED: {jp['error']} |")
    else:
         print(f"| {username} | Join Prime | {jp['api_time']:.3f} | {jp['db_time']:.3f} | {jp['db_queries']} | {jp.get('status')} |")
         
    # SPP Checkout
    spp = data["spp_checkout"]
    if "error" in spp:
         print(f"| {username} | SPP Checkout | {spp['api_time']:.3f} | {spp['db_time']:.3f} | {spp['db_queries']} | FAILED: {spp['error']} |")
    else:
         print(f"| {username} | SPP Checkout | {spp['api_time']:.3f} | {spp['db_time']:.3f} | {spp['db_queries']} | {spp.get('status')} |")
         
    # Upgrades
    for up in data["upgrades"]:
        if "error" in up:
            print(f"| {username} | Rank L{up['level']} | - | - | - | FAILED: {up['error']} |")
        else:
            print(f"| {username} | Rank L{up['level']} | {up['api_time']:.3f} | {up['db_time']:.3f} | {up['db_queries']} | {up['status']} |")
    print("|---|---|---|---|---|---|")

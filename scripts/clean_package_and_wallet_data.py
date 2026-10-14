import sys, os
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from django.db import transaction, connection
from decimal import Decimal
from accounts.models import CustomUser, Wallet, WalletAccount, RewardPointsAccount

print("=== STARTING USER PACKAGE & WALLET CLEANUP ===")

with transaction.atomic():
    cursor = connection.cursor()

    # 1. Clear all AutoPoolAccount records (Matrix trees start 100% empty)
    cursor.execute("DELETE FROM business_autopoolaccount;")
    cursor.execute("SELECT setval('business_autopoolaccount_id_seq', 1, false);")
    print("1. Cleared all AutoPoolAccounts. Matrix tree count is 0. Reset sequence to 1.")

    # 2. Clear UserMatrixProgress
    cursor.execute("DELETE FROM business_usermatrixprogress;")
    print("2. Cleared business_usermatrixprogress.")

    # 3. Clear PromoMonthlyBox (SPP monthly box tracking)
    cursor.execute("DELETE FROM business_promomonthlybox;")
    print("3. Cleared business_promomonthlybox.")

    # 4. Clear PromoPurchase & Gift Cards
    cursor.execute("DELETE FROM business_sppgiftcard;")
    cursor.execute("DELETE FROM business_promopurchase;")
    print("4. Cleared business_promopurchase and business_sppgiftcard.")

    # 5. Clear MLM Rank Upgrades, Commissions, Tree Nodes, Payments
    cursor.execute("DELETE FROM mlm_ranks_upgradecommission;")
    cursor.execute("DELETE FROM mlm_ranks_rankmatrixnode;")
    cursor.execute("DELETE FROM mlm_ranks_rankupgrade;")
    try:
        cursor.execute("DELETE FROM mlm_ranks_rankupgradepayment;")
    except Exception:
        pass
    print("5. Cleared MLM Ranks, Commissions, RankMatrixNodes.")

    # 6. Clear SSV Vouchers & reset state pools
    cursor.execute("DELETE FROM business_ssvvoucher;")
    cursor.execute("UPDATE business_statessvpool SET accumulated_amount = 0.00, seed_amount = 0.00;")
    print("6. Cleared business_ssvvoucher, reset business_statessvpool to 0.00.")

    # 7. Clear Wallet Transactions & Audits for non-admin users
    cursor.execute("DELETE FROM accounts_wallettransaction WHERE user_id NOT IN (SELECT id FROM accounts_customuser WHERE is_superuser = TRUE);")
    cursor.execute("DELETE FROM coupons_audittrail WHERE actor_id NOT IN (SELECT id FROM accounts_customuser WHERE is_superuser = TRUE);")
    print("7. Cleared non-admin accounts_wallettransaction and coupons_audittrail.")

    # 8. Reset Wallets to 0.00 via Django bulk update
    w_num_fields = [f.name for f in Wallet._meta.concrete_fields if f.get_internal_type() in ('DecimalField', 'FloatField', 'IntegerField') and f.name != 'id']
    Wallet.objects.all().update(**{f: Decimal('0.00') for f in w_num_fields})

    wa_num_fields = [f.name for f in WalletAccount._meta.concrete_fields if f.get_internal_type() in ('DecimalField', 'FloatField', 'IntegerField') and f.name != 'id']
    WalletAccount.objects.all().update(**{f: Decimal('0.00') for f in wa_num_fields})

    cursor.execute("DELETE FROM accounts_rewardpointstransaction;")
    cursor.execute("UPDATE accounts_rewardpointsaccount SET balance_points = 0.00;")
    print("8. Reset all Wallet, WalletAccount, and RewardPoints numeric balances to 0.00.")

    # 9. Reset test users to unpurchased state and password '123456'
    test_phones = ['9999999999', '8095918105', '1000000101', '1000000102', '1000000103', '1000000104', '1000000105']
    cursor.execute("""
        UPDATE accounts_customuser 
        SET account_active = FALSE
        WHERE phone IN ('9999999999', '8095918105', '1000000101', '1000000102', '1000000103', '1000000104', '1000000105')
           OR username IN ('9999999999', '8095918105', '1000000101', '1000000102', '1000000103', '1000000104', '1000000105');
    """)

    for phone in test_phones:
        tu = CustomUser.objects.filter(phone=phone).first() or CustomUser.objects.filter(username=phone).first()
        if tu:
            tu.set_password('123456')
            tu.save(update_fields=['password'])
            print(f"9. Reset test user {phone} (ID {tu.id}): account_active=False, password=123456")

print("\n=== VERIFICATION AFTER CLEANUP ===")
from business.models import AutoPoolAccount, PromoPurchase, PromoMonthlyBox
from mlm_ranks.models import RankUpgrade
from accounts.models import WalletAccount
print("AutoPoolAccount count (should be 0):", AutoPoolAccount.objects.count())
print("PromoMonthlyBox count (should be 0):", PromoMonthlyBox.objects.count())
print("PromoPurchase count (should be 0):", PromoPurchase.objects.count())
print("RankUpgrade count (should be 0):", RankUpgrade.objects.count())
print("WalletAccounts with non-zero balance (should be 0):", WalletAccount.objects.filter(current_balance__gt=0).count())
print("=== CLEANUP COMPLETED SUCCESSFULLY ===")

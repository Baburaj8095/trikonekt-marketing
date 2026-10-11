import subprocess
import sys

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_reset_code = r'''
from django.db import connection
from accounts.models import CustomUser, Wallet, WalletTransaction, WalletAccount, FinancialTransaction
from business.models import AutoPoolAccount, CommissionConfig, PromoPurchase, UserMatrixProgress, StateSSVPool, SSVVoucher
from mlm_ranks.models import RankMatrixNode, RankUpgrade, UpgradeCommission

print("=== STARTING HARD RESET (TREES, WALLETS, FRANCHISE EARNINGS) ===")
print("=== COMMISSION CONFIG WILL BE 100% UNTOUCHED ===")

# 1. Snapshot CommissionConfig before
cc_count_before = CommissionConfig.objects.count()
cc_pks_before = list(CommissionConfig.objects.values_list("id", flat=True))
print(f"Pre-check CommissionConfig count: {cc_count_before} (IDs: {cc_pks_before})")

with connection.cursor() as cur:
    cur.execute("SET session_replication_role = 'replica';")

    # A. Truncate Matrix Trees & Placements (Preserve only Root Sentinels ID 1 & 2)
    print("1. Clearing AutoPool and Rank Matrix nodes...")
    cur.execute("DELETE FROM business_autopoolaccount WHERE id > 2;")
    cur.execute("TRUNCATE TABLE business_usermatrixprogress CASCADE;")
    cur.execute("TRUNCATE TABLE mlm_ranks_rankmatrixnode CASCADE;")

    # Ensure roots are active
    cur.execute("UPDATE business_autopoolaccount SET level = 0, status = 'ACTIVE' WHERE id IN (1, 2);")

    # B. Truncate Rank Upgrades & Commissions
    print("2. Clearing Rank Upgrades and Commission holds...")
    cur.execute("TRUNCATE TABLE mlm_ranks_commissionhold CASCADE;")
    cur.execute("TRUNCATE TABLE mlm_ranks_upgradecommission CASCADE;")
    try:
        cur.execute("TRUNCATE TABLE mlm_ranks_rankupgradepayment CASCADE;")
    except Exception:
        pass
    cur.execute("TRUNCATE TABLE mlm_ranks_rankupgrade CASCADE;")
    try:
        cur.execute("TRUNCATE TABLE mlm_ranks_userrank CASCADE;")
    except Exception:
        pass

    # C. Truncate Purchases, Monthly Boxes, Vouchers
    print("3. Clearing Purchases, Monthly Boxes, and SSV Vouchers...")
    cur.execute("TRUNCATE TABLE business_promopurchase CASCADE;")
    try:
        cur.execute("TRUNCATE TABLE business_promomonthlybox CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE accounts_consumervoucher CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE business_ssvvoucher CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("UPDATE business_statessvpool SET accumulated_amount = 0.00, seed_amount = 0.00;")
    except Exception:
        pass

    # D. Truncate All Wallet Transactions & Ledgers
    print("4. Clearing all transaction ledgers and audit records...")
    cur.execute("TRUNCATE TABLE accounts_wallettransaction CASCADE;")
    cur.execute("TRUNCATE TABLE accounts_financialtransaction CASCADE;")
    try:
        cur.execute("TRUNCATE TABLE accounts_ledgerentry CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE accounts_rewardpointstransaction CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE accounts_walletuploadrequest CASCADE;")
    except Exception:
        pass

    # E. Zero Out All Wallets (Consumers, Agencies, Franchises, Admins)
    print("5. Resetting all Wallet balances to 0.00 across all accounts...")
    cur.execute("""
        UPDATE accounts_wallet 
        SET franchise_total_earning = 0.00,
            franchise_active_work = 0.00,
            franchise_inactive_work = 0.00,
            franchise_self_rebirth = 0.00,
            franchise_company_marketing = 0.00,
            franchise_reward_points = 0.00,
            franchise_shopping_scanner = 0.00,
            updated_at = NOW();
    """)

    cur.execute("""
        UPDATE accounts_walletaccount 
        SET current_balance = 0.00,
            available_balance = 0.00,
            updated_at = NOW();
    """)

    try:
        cur.execute("UPDATE accounts_rewardpointsaccount SET balance = 0.00, updated_at = NOW();")
    except Exception:
        pass

    # F. Reset Consumer account activation and rank status (Users preserved)
    print("6. Resetting consumer active state (preserving all user profiles and franchise setups)...")
    cur.execute("UPDATE accounts_customuser SET account_active = FALSE WHERE role IN ('user', 'consumer') AND is_superuser = FALSE;")

    cur.execute("SET session_replication_role = 'origin';")

# 2. Snapshot CommissionConfig after
cc_count_after = CommissionConfig.objects.count()
cc_pks_after = list(CommissionConfig.objects.values_list("id", flat=True))
print(f"Post-check CommissionConfig count: {cc_count_after} (IDs: {cc_pks_after})")

if cc_count_before != cc_count_after or cc_pks_before != cc_pks_after:
    print("FATAL ERROR: CommissionConfig was modified!")
    sys.exit(1)

print("\n=== VERIFICATION SUMMARY ===")
print(f"CommissionConfig: 100% PRESERVED ({cc_count_after} configs unchanged)")
print(f"Total Users: {CustomUser.objects.count()} (Admin: {CustomUser.objects.filter(is_superuser=True).count()}, Agencies: {CustomUser.objects.filter(role='agency').count()}, Consumers: {CustomUser.objects.filter(role__in=['user', 'consumer']).count()})")
print(f"AutoPoolAccounts: {AutoPoolAccount.objects.count()} (Sentinel Roots #1 and #2 preserved)")
print(f"RankMatrixNodes: {RankMatrixNode.objects.count()}")
print(f"PromoPurchases: {PromoPurchase.objects.count()}")
print(f"WalletTransactions: {WalletTransaction.objects.count()}")
print(f"FinancialTransactions: {FinancialTransaction.objects.count()}")

# Verify all wallet balances are 0.00
nonzero_wallets = Wallet.objects.filter(franchise_total_earning__gt=0).count()
print(f"Non-zero Wallets: {nonzero_wallets} (must be 0)")
nonzero_accounts = WalletAccount.objects.filter(current_balance__gt=0).count()
print(f"Non-zero WalletAccounts: {nonzero_accounts} (must be 0)")

print("\n=== HARD RESET COMPLETED SUCCESSFULLY! READY FOR FRESH TESTING! ===")
'''

local_script = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\_tmp_hard_reset.py"
with open(local_script, "w", encoding="utf-8") as f:
    f.write(py_reset_code)

print("Uploading hard reset script to EC2...")
subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_script, f"{ec2_user}@{ec2_ip}:/tmp/_tmp_hard_reset.py"
], check=True)

print("Executing hard reset on staging database...")
remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/staging/backend/.venv/bin/python3 /srv/trikonekt/staging/backend/manage.py shell < /tmp/_tmp_hard_reset.py'"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True, timeout=60)

print("STDOUT:\n", res.stdout)
if res.stderr:
    print("STDERR:\n", res.stderr)

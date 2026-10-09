import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
from django.db import connection
from accounts.models import CustomUser, Wallet, WalletTransaction, FinancialTransaction, WalletAccount, LedgerEntry
from business.models import AutoPoolAccount, PromoPurchase, UserMatrixProgress
from mlm_ranks.models import UserRank, RankUpgrade, UpgradeCommission, CommissionHold

print("=== STARTING COMPLETE CLEAN RESET OF ALL NON-ADMIN DATA ===")

with connection.cursor() as cur:
    # Use replica mode to bypass foreign key constraint ordering and trigger traps
    cur.execute("SET session_replication_role = 'replica';")

    # 1. Nullify all tree relationships and uplines
    cur.execute("UPDATE accounts_customuser SET registered_by_id = NULL, parent_id = NULL;")

    # 2. Clear all Matrix / AutoPool block trees completely
    cur.execute("TRUNCATE TABLE business_autopoolaccount CASCADE;")
    cur.execute("TRUNCATE TABLE business_usermatrixprogress CASCADE;")

    # 3. Clear all Activations, Purchases, and Vouchers
    cur.execute("TRUNCATE TABLE business_promopurchase CASCADE;")
    try:
        cur.execute("TRUNCATE TABLE coupons_audit_trail CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE coupons_purchaseorder CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE coupons_voucher CASCADE;")
    except Exception:
        pass

    # 4. Clear all Rank Upgrades and Commissions
    cur.execute("TRUNCATE TABLE mlm_ranks_commissionhold CASCADE;")
    cur.execute("TRUNCATE TABLE mlm_ranks_upgradecommission CASCADE;")
    cur.execute("TRUNCATE TABLE mlm_ranks_rankupgradepayment CASCADE;")
    cur.execute("TRUNCATE TABLE mlm_ranks_rankupgrade CASCADE;")
    cur.execute("TRUNCATE TABLE mlm_ranks_userrank CASCADE;")

    # 5. Clear all Wallet Transactions, Financial Transactions, Ledger Entries
    cur.execute("TRUNCATE TABLE accounts_wallettransaction CASCADE;")
    cur.execute("TRUNCATE TABLE accounts_financialtransaction CASCADE;")
    try:
        cur.execute("TRUNCATE TABLE accounts_ledgerentry CASCADE;")
    except Exception:
        pass
    try:
        cur.execute("TRUNCATE TABLE accounts_walletuploadrequest CASCADE;")
    except Exception:
        pass

    # 6. Delete all users except Superuser (admin) and Company Root User (ID=2 / 9999999999)
    cur.execute("SELECT id FROM accounts_customuser WHERE is_superuser = TRUE OR id = 2 OR username IN ('admin', 'company', '9999999999');")
    keep_rows = cur.fetchall()
    keep_ids = [r[0] for r in keep_rows]
    print(f"Preserving Administrator / Company User IDs: {keep_ids}")

    if keep_ids:
        format_ids = ','.join(str(i) for i in keep_ids)
        cur.execute(f"DELETE FROM accounts_customuser WHERE id NOT IN ({format_ids});")
    
    # 7. Delete non-admin wallets and wallet accounts
    cur.execute("DELETE FROM accounts_wallet WHERE user_id NOT IN (" + ','.join(str(i) for i in keep_ids) + ");")
    cur.execute("DELETE FROM accounts_walletaccount WHERE user_id NOT IN (" + ','.join(str(i) for i in keep_ids) + ");")
    
    # Zero out balances in WalletAccount (core ledger engine) and legacy Wallet fields
    cur.execute("UPDATE accounts_walletaccount SET current_balance = 0.00, available_balance = 0.00, updated_at = NOW();")
    cur.execute("UPDATE accounts_wallet SET franchise_total_earning = 0.00, franchise_active_work = 0.00, franchise_inactive_work = 0.00, franchise_self_rebirth = 0.00, franchise_company_marketing = 0.00, franchise_reward_points = 0.00, franchise_shopping_scanner = 0.00, updated_at = NOW();")

    # 8. Reset AutoPool / Rank sequences
    try:
        cur.execute("ALTER SEQUENCE business_autopoolaccount_id_seq RESTART WITH 1;")
    except Exception:
        pass

    # Re-enable standard trigger checks
    cur.execute("SET session_replication_role = 'origin';")

print("=== VERIFYING CLEAN STATE AFTER RESET ===")
print(f"Remaining CustomUsers: {CustomUser.objects.count()} -> {[u.username for u in CustomUser.objects.all()]}")
print(f"Remaining Wallets: {Wallet.objects.count()}")
print(f"Remaining WalletAccounts: {WalletAccount.objects.count()}")
print(f"Remaining WalletTransactions: {WalletTransaction.objects.count()}")
print(f"Remaining FinancialTransactions: {FinancialTransaction.objects.count()}")
print(f"Remaining AutoPoolAccounts (Trees): {AutoPoolAccount.objects.count()}")
print(f"Remaining PromoPurchases: {PromoPurchase.objects.count()}")
print(f"Remaining RankUpgrades: {RankUpgrade.objects.count()}")
print("=== COMPLETE DATABASE WIPE & RESET FINISHED SUCCESSFULLY! ===")
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\run_clean_reset.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

print("Executing clean wipe on EC2...")
subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/run_clean_reset.py"
], check=True)

remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/staging/backend/.venv/bin/python3 /srv/trikonekt/staging/backend/manage.py shell < /tmp/run_clean_reset.py'"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

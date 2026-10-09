import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

remote_py_code = """
from django.db import connection, transaction
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount, UserMatrixProgress, PromoPurchase
from mlm_ranks.models import RankUpgrade, UpgradeCommission, CommissionHold, UserRank
from coupons.models import AuditTrail

u = CustomUser.objects.filter(username='8095918105').first() or CustomUser.objects.filter(phone='8095918105').first()
if not u:
    print('USER 8095918105 NOT FOUND!')
else:
    sp = u.registered_by
    uid = u.id
    print(f'RESETTING DATA FOR USER: {u.username} (ID {uid})')

    with connection.cursor() as cur:
        # Clear wallet upload requests pointing to wallet transactions
        cur.execute("UPDATE accounts_walletuploadrequest SET wallet_transaction_id = NULL WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM accounts_walletuploadrequest WHERE user_id = %s;", [uid])

        # Delete double-entry financial transactions and ledger entries first
        cur.execute("DELETE FROM accounts_ledgerentry WHERE user_id = %s OR financial_transaction_id IN (SELECT id FROM accounts_financialtransaction WHERE user_id = %s OR legacy_wallet_transaction_id IN (SELECT id FROM accounts_wallettransaction WHERE user_id = %s OR meta->>'from_user_id' = %s));", [uid, uid, uid, str(uid)])
        cur.execute("DELETE FROM accounts_financialtransaction WHERE user_id = %s OR legacy_wallet_transaction_id IN (SELECT id FROM accounts_wallettransaction WHERE user_id = %s OR meta->>'from_user_id' = %s);", [uid, uid, str(uid)])

        # Delete related promo product orders, monthly boxes, invoices
        cur.execute("DELETE FROM business_packageinvoice WHERE promo_purchase_id IN (SELECT id FROM business_promopurchase WHERE user_id = %s);", [uid])
        cur.execute("DELETE FROM business_promoproductorder WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM business_promomonthlybox WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM business_promo759subscription WHERE user_id = %s;", [uid])

        # Delete Rank Upgrade payments, commissions, and holds
        cur.execute("DELETE FROM mlm_ranks_rankupgradepayment WHERE upgrade_id IN (SELECT id FROM mlm_ranks_rankupgrade WHERE user_id = %s);", [uid])
        cur.execute("DELETE FROM mlm_ranks_commissionhold WHERE commission_id IN (SELECT id FROM mlm_ranks_upgradecommission WHERE from_user_id = %s OR to_user_id = %s);", [uid, uid])
        cur.execute("DELETE FROM mlm_ranks_upgradecommission WHERE from_user_id = %s OR to_user_id = %s;", [uid, uid])
        cur.execute("DELETE FROM mlm_ranks_rankupgrade WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM mlm_ranks_userrank WHERE user_id = %s;", [uid])

        # Delete Promo Purchases
        cur.execute("DELETE FROM business_promopurchase WHERE user_id = %s;", [uid])

        # Delete Wallet transactions for u and meta transactions from u
        cur.execute("DELETE FROM accounts_wallettransaction WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM accounts_wallettransaction WHERE meta->>'from_user_id' = %s;", [str(uid)])

        # Clear AuditTrail
        cur.execute("DELETE FROM coupons_audittrail WHERE actor_id = %s;", [uid])
        cur.execute("DELETE FROM coupons_audittrail WHERE metadata->>'user_id' = %s;", [str(uid)])

        # Delete UserMatrixProgress
        cur.execute("DELETE FROM business_usermatrixprogress WHERE user_id = %s;", [uid])

        # Safely delete AutoPoolAccounts for user 3 one by one using ORM to allow placement cleanup
        ap_list = list(AutoPoolAccount.objects.filter(owner=u))
        for ap in ap_list:
            children = list(AutoPoolAccount.objects.filter(parent_account=ap))
            for ch in children:
                ch.parent_account = ap.parent_account
                ch.save()
            ap.delete()
        print(f'Deleted {len(ap_list)} AutoPoolAccounts for user 8095918105.')

        # Reset CustomUser flags for u
        u.account_active = False
        u.is_prime = False
        u.parent = None
        u.matrix_position = None
        u.depth = 0
        u.save()

        # Reset Wallet for u
        w = Wallet.objects.filter(user=u).first()
        if w:
            w.main_balance = 0
            w.self_account_balance = 0
            w.withdrawable_balance = 0
            w.franchise_total_earning = 0
            w.save()

    # Recalculate Sponsor wallet balance if sponsor exists
    if sp:
        sp_w = Wallet.objects.filter(user=sp).first()
        if sp_w:
            sp_txs = WalletTransaction.objects.filter(user=sp)
            main_sum = sum(tx.amount for tx in sp_txs if tx.type in ('INCOME_CREDIT_75', 'COMMISSION_CREDIT'))
            self_sum = sum(tx.amount for tx in sp_txs if tx.type == 'SELF_ACCOUNT_CREDIT')
            sp_w.main_balance = main_sum
            sp_w.self_account_balance = self_sum
            sp_w.save()
            print(f'Recalculated Sponsor ({sp.username}) Wallet: Main={sp_w.main_balance}, Self={sp_w.self_account_balance}')

    print('\\n=== CLEANUP SUCCESSFUL FOR USER 8095918105 ===')
"""

# Write remote python file
ssh_cmd1 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    f"cat << 'EOF' > /tmp/clean_user.py\n{remote_py_code}\nEOF"
]
subprocess.run(ssh_cmd1)

# Run python script inside manage.py shell
remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/clean_user.py'"

ssh_cmd2 = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}",
    remote_cmd
]

res = subprocess.run(ssh_cmd2, capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

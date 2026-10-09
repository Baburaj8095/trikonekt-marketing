import subprocess

ssh_key_path = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"

py_code = r"""
from django.db import connection
from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import AutoPoolAccount

target_username = '8095918105'
sponsor_username = '9999999999'

print("=== STARTING CLEAN DJANGO ORM CASCADE RESET ===")

u = CustomUser.objects.filter(username=target_username).first()
sp = CustomUser.objects.filter(username=sponsor_username).first()
sp_id = sp.id if sp else None

if u:
    uid = u.id
    print(f"Found Target User {target_username} (ID #{uid}). Nullifying circular references...")

    with connection.cursor() as cur:
        # Disable triggers and FK cascade traps in Postgres during reset
        cur.execute("SET session_replication_role = 'replica';")

        # 1. Nullify circular references
        cur.execute("UPDATE accounts_customuser SET registered_by_id = NULL, parent_id = NULL WHERE id = %s;", [uid])
        cur.execute("UPDATE accounts_customuser SET registered_by_id = NULL WHERE registered_by_id = %s;", [uid])
        cur.execute("UPDATE accounts_customuser SET parent_id = NULL WHERE parent_id = %s;", [uid])

        # 2. Delete all records associated with target user (8095918105) and sponsor (9999999999) transactions
        cur.execute("DELETE FROM business_autopoolaccount WHERE owner_id = %s;", [uid])
        cur.execute("DELETE FROM business_usermatrixprogress WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM business_promopurchase WHERE user_id = %s;", [uid])
        cur.execute("DELETE FROM mlm_ranks_upgradecommission WHERE upgrade_id IN (SELECT id FROM mlm_ranks_rankupgrade WHERE user_id = %s);", [uid])
        cur.execute("DELETE FROM mlm_ranks_commissionhold;")
        cur.execute("DELETE FROM mlm_ranks_rankupgrade WHERE user_id = %s;", [uid])

        cur.execute("DELETE FROM accounts_ledgerentry WHERE user_id = %s OR user_id = %s;", [uid, sp_id if sp_id else 0])
        cur.execute("DELETE FROM accounts_financialtransaction WHERE user_id = %s OR user_id = %s;", [uid, sp_id if sp_id else 0])
        cur.execute("DELETE FROM accounts_wallettransaction WHERE user_id = %s OR user_id = %s OR meta::text LIKE %s OR meta::text LIKE %s;", [uid, sp_id if sp_id else 0, f'%"{target_username}"%', f'%"{uid}"%'])

        # Delete target user
        cur.execute("DELETE FROM accounts_customuser WHERE id = %s;", [uid])

        # Re-enable triggers
        cur.execute("SET session_replication_role = 'origin';")
        print("Database purge completed cleanly with session_replication_role = replica.")

# Reset Sponsor Wallet via Django ORM
if sp:
    w_sp = Wallet.objects.filter(user=sp).first()
    if w_sp:
        for attr in ['main_balance', 'self_account_balance', 'total_earnings', 'income_credit_75', 'self_account_credit_25']:
            if hasattr(w_sp, attr):
                setattr(w_sp, attr, 0.0)
        w_sp.save()
        print(f"Reset Sponsor {sp.username} Wallet balances to 0.")

# Re-create Sponsor & User fresh
sp, _ = CustomUser.objects.get_or_create(username=sponsor_username, defaults={'category': 'consumer', 'role': 'user', 'account_active': True})
if not sp.account_active:
    sp.account_active = True
    sp.save()

u, created = CustomUser.objects.get_or_create(
    username=target_username,
    defaults={
        'phone': target_username,
        'registered_by': sp,
        'category': 'consumer',
        'role': 'user',
        'account_active': True
    }
)
u.registered_by = sp
u.account_active = True
u.save()

w_u, _ = Wallet.objects.get_or_create(user=u)
for attr in ['main_balance', 'self_account_balance', 'total_earnings', 'income_credit_75', 'self_account_credit_25']:
    if hasattr(w_u, attr):
        setattr(w_u, attr, 0.0)
w_u.save()

print(f"=== SUCCESSFULLY RESET USER {target_username} (ID #{u.id}) AND SPONSOR {sponsor_username} TO FRESH STATE WITH 0 BALANCES! ===")
"""

local_tmp_path = r"c:\Users\babur\OneDrive\Desktop\Trikonekt\trikonekt-marketing\scripts\tmp_reset_orm.py"
with open(local_tmp_path, "w", encoding="utf-8") as f:
    f.write(py_code)

subprocess.run([
    "scp", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    local_tmp_path, f"{ec2_user}@{ec2_ip}:/tmp/tmp_reset_orm.py"
], check=True)

remote_cmd = "sudo bash -c 'set -a; source /etc/trikonekt/staging-backend.env; set +a; /srv/trikonekt/app/backend/.venv/bin/python3 /srv/trikonekt/app/backend/manage.py shell < /tmp/tmp_reset_orm.py'"
res = subprocess.run([
    "ssh", "-i", ssh_key_path, "-o", "StrictHostKeyChecking=no",
    f"{ec2_user}@{ec2_ip}", remote_cmd
], capture_output=True, text=True)

print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)

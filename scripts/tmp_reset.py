
from django.db import connection
from accounts.models import CustomUser, Wallet

target_username = '8095918105'
sponsor_username = '9999999999'

u = CustomUser.objects.filter(username=target_username).first()
sp = CustomUser.objects.filter(username=sponsor_username).first()
sp_id = sp.id if sp else None

print("=== STARTING FULL CLEAN RESET FOR USER 8095918105 AND UPLINES ===")

with connection.cursor() as cur:
    # 1. Find user ID for 8095918105
    cur.execute("SELECT id FROM accounts_customuser WHERE username=%s OR phone=%s;", [target_username, target_username])
    row = cur.fetchone()
    if row:
        uid = row[0]
        print(f"Found Target User: {target_username} (ID #{uid}). Deleting all dependent FK tables...")

        # 1. Nullify circular user references first
        cur.execute("UPDATE accounts_customuser SET registered_by_id = NULL WHERE registered_by_id = %s;", [uid])
        cur.execute("UPDATE accounts_customuser SET parent_id = NULL WHERE parent_id = %s;", [uid])
        cur.execute("UPDATE accounts_walletuploadrequest SET wallet_transaction_id = NULL WHERE user_id = %s;", [uid])

        # Delete ledgerentry referencing financialtransaction before deleting financialtransaction
        cur.execute("DELETE FROM accounts_ledgerentry WHERE financial_transaction_id IN (SELECT id FROM accounts_financialtransaction WHERE user_id = %s OR user_id = %s);", [uid, sp_id])
        cur.execute("DELETE FROM accounts_ledgerentry WHERE user_id = %s OR user_id = %s;", [uid, sp_id])
        cur.execute("DELETE FROM accounts_financialtransaction WHERE user_id = %s OR user_id = %s OR legacy_wallet_transaction_id IN (SELECT id FROM accounts_wallettransaction WHERE user_id = %s OR user_id = %s OR meta::text LIKE %s OR meta::text LIKE %s);", [uid, sp_id, uid, sp_id, f'%"{target_username}"%', f'%"{uid}"%'])

        # Cleanly remove target user's AutoPoolAccount tree first
        cur.execute("UPDATE business_autopoolaccount SET parent_account_id = NULL WHERE owner_id = %s OR parent_account_id IN (SELECT id FROM business_autopoolaccount WHERE owner_id = %s);", [uid, uid])
        cur.execute("DELETE FROM business_autopoolaccount WHERE owner_id = %s;", [uid])
        print("Cleared AutoPoolAccount tree for target user.")

        # Query Postgres information schema to find ALL foreign keys pointing to accounts_customuser
        cur.execute("SELECT kcu.table_name, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'accounts_customuser' AND ccu.column_name = 'id';")
        fks = cur.fetchall()

        # Delete dependent FK tables
        for table_name, column_name in fks:
            if table_name in ('accounts_customuser', 'business_autopoolaccount'):
                continue
            try:
                cur.execute(f"DELETE FROM {table_name} WHERE {column_name} = %s;", [uid])
            except Exception as e:
                if table_name != 'business_autopoolaccount':
                    try:
                        cur.execute(f"UPDATE {table_name} SET {column_name} = NULL WHERE {column_name} = %s;", [uid])
                    except Exception as e2:
                        print(f"Skipped {table_name}.{column_name}: {e2}")

        # Delete target user from accounts_customuser
        cur.execute("DELETE FROM accounts_customuser WHERE id = %s;", [uid])
        print(f"Target User {target_username} completely purged from DB.")

    # 2. Reset Sponsor (9999999999) Ledger and Wallet
    cur.execute("SELECT id FROM accounts_customuser WHERE username=%s OR phone=%s;", [sponsor_username, sponsor_username])
    sp_row = cur.fetchone()
    if sp_row:
        sp_id = sp_row[0]
        print(f"Cleaning Sponsor {sponsor_username} (ID #{sp_id}) ledgers and transactions...")
        cur.execute("DELETE FROM accounts_ledgerentry WHERE user_id = %s;", [sp_id])
        cur.execute("DELETE FROM accounts_financialtransaction WHERE user_id = %s;", [sp_id])
        cur.execute("DELETE FROM accounts_wallettransaction WHERE user_id = %s;", [sp_id])
        cur.execute("UPDATE accounts_wallet SET main_balance = 0.00, self_account_balance = 0.00, total_earnings = 0.00, income_credit_75 = 0.00, self_account_credit_25 = 0.00 WHERE user_id = %s;", [sp_id])
        print(f"Reset Sponsor {sponsor_username} Wallet to ₹0.00.")

# 3. Re-create Sponsor (if not exists) and User 8095918105 fresh
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
w_u.main_balance = 0.00
w_u.self_account_balance = 0.00
w_u.total_earnings = 0.00
w_u.save()

print(f"=== RE-CREATED USER {target_username} FRESH (ID #{u.id}, Sponsor: {sp.username}) WITH ZERO BALANCES! ===")

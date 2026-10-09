
import json
import psycopg2

conn = psycopg2.connect("dbname=trikonekt user=postgres host=localhost")
cur = conn.cursor()

phones = ('9999999999', '8095918105')
cur.execute("SELECT id, username, phone, email, is_active FROM accounts_customuser WHERE phone IN %s OR username IN %s;", (phones, phones))
users = cur.fetchall()
print("Found users:", users)

for u in users:
    uid = u[0]
    uname = u[1]
    print(f"\n--- Data for user {uname} (ID: {uid}) ---")
    
    cur.execute("SELECT count(*) FROM business_promopurchase WHERE user_id = %s;", (uid,))
    print(f"PromoPurchase count: {cur.fetchone()[0]}")
    
    cur.execute("SELECT count(*) FROM business_promomonthlybox WHERE user_id = %s;", (uid,))
    print(f"PromoMonthlyBox count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM business_autopoolaccount WHERE owner_id = %s;", (uid,))
    print(f"AutoPoolAccount count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM mlm_ranks_rankupgrade WHERE user_id = %s;", (uid,))
    print(f"RankUpgrade count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM mlm_ranks_upgradecommission WHERE to_user_id = %s OR from_user_id = %s;", (uid, uid))
    print(f"UpgradeCommission count: {cur.fetchone()[0]}")

    cur.execute("SELECT count(*) FROM accounts_wallettransaction WHERE user_id = %s;", (uid,))
    print(f"WalletTransaction count: {cur.fetchone()[0]}")

    cur.execute("SELECT balance, main_balance, withdrawable_balance FROM accounts_wallet WHERE user_id = %s;", (uid,))
    row = cur.fetchone()
    print(f"Wallet balances: {row}")

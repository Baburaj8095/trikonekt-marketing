import os
import sys
import time
import subprocess

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("Installing psycopg2-binary...")
    os.system(f"{sys.executable} -m pip install psycopg2-binary")
    import psycopg2
    import psycopg2.extras

ssh_key_path = r"C:\Users\Baburaj\.ssh\trikonekt-prod-key.pem"
ec2_ip = "65.0.40.184"
ec2_user = "ubuntu"
rds_host = "trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com"
local_port = 6543

print(f"Starting SSH Tunnel to EC2 ({ec2_ip}) forwarding local port {local_port} to AWS RDS...")

ssh_cmd = [
    "ssh",
    "-i", ssh_key_path,
    "-o", "StrictHostKeyChecking=no",
    "-N",
    "-L", f"{local_port}:{rds_host}:5432",
    f"{ec2_user}@{ec2_ip}"
]

tunnel_proc = subprocess.Popen(ssh_cmd)
time.sleep(3) # Wait for SSH tunnel to establish

try:
    print(f"Connecting to AWS RDS PostgreSQL via localhost:{local_port}...")
    conn = psycopg2.connect(
        dbname="trikonekt",
        user="trikonekt_admin",
        password="Baburajnk19",
        host="127.0.0.1",
        port=local_port,
        connect_timeout=10
    )
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    print("SUCCESS: Connected to AWS RDS Production PostgreSQL Database!\n")

    # 1. Add Money Upload Requests
    cursor.execute("""
        SELECT 
            w.id,
            w.amount,
            w.status,
            w.utr,
            w.created_at,
            u.id as user_id,
            u.username,
            u.mobile,
            u.first_name,
            u.last_name
        FROM accounts_walletuploadrequest w
        LEFT JOIN accounts_customuser u ON w.user_id = u.id
        ORDER BY w.created_at DESC;
    """)
    wallet_rows = cursor.fetchall()

    # 2. Promo Package Purchases
    cursor.execute("""
        SELECT 
            p.id,
            p.total_amount,
            p.status,
            p.created_at,
            u.username,
            u.mobile
        FROM business_promopurchase p
        LEFT JOIN accounts_customuser u ON p.user_id = u.id
        ORDER BY p.created_at DESC;
    """)
    promo_rows = cursor.fetchall()

    # Dummy test user filter rules specified by user: 999999999*, 11*, 00*
    def is_dummy(phone, username):
        p = str(phone or "").strip()
        u = str(username or "").strip()
        if p.startswith("999999999") or p.startswith("11") or p.startswith("00"):
            return True
        if u.startswith("999999999") or u.startswith("11") or u.startswith("00"):
            return True
        if p in ["0", "1"] or u in ["0", "1"]:
            return True
        return False

    def get_month_key(dt):
        if not dt:
            return None
        if dt.year == 2026:
            if dt.month == 5:
                return "May 2026"
            elif dt.month == 6:
                return "June 2026"
            elif dt.month == 7:
                return "July 2026"
        return f"{dt.strftime('%B %Y')}"

    stats = {
        "May 2026": {"add_money": 0.0, "add_money_count": 0, "promo": 0.0, "promo_count": 0, "users": set()},
        "June 2026": {"add_money": 0.0, "add_money_count": 0, "promo": 0.0, "promo_count": 0, "users": set()},
        "July 2026": {"add_money": 0.0, "add_money_count": 0, "promo": 0.0, "promo_count": 0, "users": set()},
    }

    # Process Add Money
    for r in wallet_rows:
        status = str(r['status'] or "").upper()
        if status != "APPROVED":
            continue
        phone = r['mobile'] or r['username']
        if is_dummy(phone, r['username']):
            continue
        m = get_month_key(r['created_at'])
        if m in stats:
            amt = float(r['amount'] or 0)
            stats[m]["add_money"] += amt
            stats[m]["add_money_count"] += 1
            if r['user_id']:
                stats[m]["users"].add(r['user_id'])

    # Process Promo Purchases
    for r in promo_rows:
        status = str(r['status'] or "").upper()
        if status != "APPROVED":
            continue
        phone = r['mobile'] or r['username']
        if is_dummy(phone, r['username']):
            continue
        m = get_month_key(r['created_at'])
        if m in stats:
            amt = float(r['total_amount'] or 0)
            stats[m]["promo"] += amt
            stats[m]["promo_count"] += 1

    print("==========================================================")
    print("      EXACT COMPANY EARNINGS REPORT (AWS RDS POSTGRES)     ")
    print("==========================================================")
    print("Filtering Excluded Dummy Test Accounts: 999999999*, 11*, 00*\n")

    grand_add_money = 0.0
    grand_add_money_cnt = 0
    grand_promo = 0.0
    grand_promo_cnt = 0
    grand_users = set()

    for m in ["May 2026", "June 2026", "July 2026"]:
        data = stats[m]
        tot = data["add_money"] + data["promo"]
        grand_add_money += data["add_money"]
        grand_add_money_cnt += data["add_money_count"]
        grand_promo += data["promo"]
        grand_promo_cnt += data["promo_count"]
        grand_users.update(data["users"])

        print(f"--- {m} ---")
        print(f"  Add Money Credited : ₹{data['add_money']:,.2f} ({data['add_money_count']} approved top-ups, {len(data['users'])} unique valid users)")
        print(f"  Package Sales      : ₹{data['promo']:,.2f} ({data['promo_count']} approved purchases)")
        print(f"  Total Month Revenue: ₹{tot:,.2f}\n")

    grand_total = grand_add_money + grand_promo
    print("==========================================================")
    print(f"GRAND TOTAL EARNINGS (May + June + July 2026): ₹{grand_total:,.2f}")
    print(f"  - Total Add Money Credited: ₹{grand_add_money:,.2f} ({grand_add_money_cnt} top-ups, {len(grand_users)} unique valid users)")
    print(f"  - Total Package Sales     : ₹{grand_promo:,.2f} ({grand_promo_cnt} package sales)")
    print("==========================================================")

    conn.close()

except Exception as e:
    print("ERROR Querying Database via SSH Tunnel:", e)
finally:
    tunnel_proc.terminate()

import os
import sys
import socket

# Check sshtunnel or paramiko
try:
    from sshtunnel import SSHTunnelForwarder
except ImportError:
    print("Installing sshtunnel...")
    os.system(f"{sys.executable} -m pip install sshtunnel paramiko")
    from sshtunnel import SSHTunnelForwarder

import psycopg2
import psycopg2.extras

ssh_key_path = r"C:\Users\Baburaj\.ssh\trikonekt-prod-key.pem"

print("Resolving host IP for api.growth.vin...")
try:
    target_ip = socket.gethostbyname("api.growth.vin")
    print(f"api.growth.vin resolves to: {target_ip}")
except Exception as e:
    target_ip = "api.growth.vin"
    print("Could not resolve domain, fallback to hostname.")

ssh_user = "ubuntu" # Standard AWS EC2 Ubuntu user
rds_host = "trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com"
rds_port = 5432
rds_user = "trikonekt_admin"
rds_pass = "Baburajnk19"
rds_db = "trikonekt"

print(f"Opening SSH tunnel to {target_ip} with key {ssh_key_path}...")

# Try connecting via SSH Tunnel
try:
    server = SSHTunnelForwarder(
        (target_ip, 22),
        ssh_username=ssh_user,
        ssh_pkey=ssh_key_path,
        remote_bind_address=(rds_host, rds_port),
        local_bind_address=('127.0.0.1', 6543)
    )
    server.start()
    print(f"SUCCESS: SSH Tunnel established on local port {server.local_bind_port}!\n")

    # Connect to PostgreSQL via local SSH tunnel port
    conn = psycopg2.connect(
        dbname=rds_db,
        user=rds_user,
        password=rds_pass,
        host='127.0.0.1',
        port=server.local_bind_port,
        sslmode='prefer'
    )
    cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    print("SUCCESS: Connected to AWS RDS PostgreSQL via SSH Tunnel!\n")

    # Query wallet upload requests (Add Money)
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

    # Query promo package purchases
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
    print("      EXACT COMPANY EARNINGS REPORT (VIA AWS SSH TUNNEL)   ")
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
        print(f"  Add Money Credited : ₹{data['add_money']:,.2f} ({data['add_money_count']} approved top-ups, {len(data['users'])} unique users)")
        print(f"  Package Sales      : ₹{data['promo']:,.2f} ({data['promo_count']} approved purchases)")
        print(f"  Total Month Revenue: ₹{tot:,.2f}\n")

    grand_total = grand_add_money + grand_promo
    print("==========================================================")
    print(f"GRAND TOTAL EARNINGS (May + June + July 2026): ₹{grand_total:,.2f}")
    print(f"  - Total Add Money Credited: ₹{grand_add_money:,.2f} ({grand_add_money_cnt} top-ups, {len(grand_users)} unique users)")
    print(f"  - Total Package Sales     : ₹{grand_promo:,.2f} ({grand_promo_cnt} package sales)")
    print("==========================================================")

    conn.close()
    server.stop()

except Exception as e:
    print("SSH Tunnel or Database Error:", e)

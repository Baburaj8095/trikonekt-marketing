#!/usr/bin/env python3
import psycopg2
import psycopg2.extras
import json

conn = psycopg2.connect("dbname=trikonekt_staging user=trikonekt_admin password=Baburajnk19 host=trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com sslmode=require")
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. Commission Config (Tax Settings) ===")
cur.execute("SELECT id, tax_percent, master_commission_json FROM business_commissionconfig LIMIT 1;")
cfg = cur.fetchone()
if cfg:
    print("Tax Percent Column:", cfg.get("tax_percent"))
    master = cfg.get("master_commission_json") or {}
    print("Custom Module Tax:", master.get("custom_module_tax", {}))
    print("Rank Upgrade Config:", master.get("rank_upgrade", {}))

print("\n=== 2. Users (8095918105, 9999999999) ===")
cur.execute("SELECT id, username, phone, registered_by_id FROM accounts_customuser WHERE username IN ('8095918105', '9999999999') OR phone IN ('8095918105', '9999999999');")
users = cur.fetchall()
for u in users:
    print(dict(u))

u_buyer = next((u for u in users if u['username'] == '8095918105' or u['phone'] == '8095918105'), None)
u_sponsor = next((u for u in users if u['username'] == '9999999999' or u['phone'] == '9999999999'), None)

if u_buyer:
    buyer_id = u_buyer['id']
    print(f"\n=== 3. Rank Upgrades for 8095918105 (ID {buyer_id}) ===")
    cur.execute("SELECT id, from_rank_id, to_rank_id, upgrade_amount, gst_amount, net_amount, payment_status, created_at FROM mlm_ranks_rankupgrade WHERE user_id = %s ORDER BY id;", (buyer_id,))
    upgrades = cur.fetchall()
    for upg in upgrades:
        print(dict(upg))

    print(f"\n=== 4. Upgrade Commissions from 8095918105 (ID {buyer_id}) ===")
    cur.execute("SELECT id, upgrade_id, to_user_id, level, commission_type, commission_amount, status FROM mlm_ranks_upgradecommission WHERE from_user_id = %s ORDER BY id;", (buyer_id,))
    comms = cur.fetchall()
    for c in comms:
        print(dict(c))

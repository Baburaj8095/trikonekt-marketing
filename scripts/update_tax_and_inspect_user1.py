#!/usr/bin/env python3
import psycopg2
import psycopg2.extras
import json

conn = psycopg2.connect("dbname=trikonekt_staging user=trikonekt_admin password=Baburajnk19 host=trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com sslmode=require")
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

print("=== 1. Updating tax_rank to 18 in CommissionConfig ===")
cur.execute("SELECT id, tax_percent, master_commission_json FROM business_commissionconfig LIMIT 1;")
cfg = cur.fetchone()
if cfg:
    master = cfg.get("master_commission_json") or {}
    custom_tax = master.get("custom_module_tax") or {}
    custom_tax["tax_rank"] = 18
    custom_tax["tax_150"] = 18
    custom_tax["tax_750"] = 18
    custom_tax["tax_spp"] = 18
    custom_tax["tax_rebirth"] = 18
    master["custom_module_tax"] = custom_tax
    cur.execute("UPDATE business_commissionconfig SET master_commission_json = %s, tax_percent = 18.00 WHERE id = %s;", (json.dumps(master), cfg['id']))
    conn.commit()
    print("CommissionConfig updated successfully! New custom_module_tax:", custom_tax)

print("\n=== 2. Checking user 0000000001 status and tree position ===")
cur.execute("SELECT id, username, phone, registered_by_id FROM accounts_customuser WHERE username = '0000000001' OR phone = '0000000001';")
u1 = cur.fetchone()
if u1:
    print("User 0000000001:", dict(u1))
    cur.execute("SELECT * FROM mlm_ranks_rankmatrixnode WHERE placed_user_id = %s;", (u1['id'],))
    nodes = cur.fetchall()
    print("RankMatrixNode placements for 0000000001:", [dict(n) for n in nodes])
else:
    print("User 0000000001 not found.")

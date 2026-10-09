import subprocess

ssh_key = r"C:\Users\babur\Downloads\TRI_MARKETING.pem"

sql = """
SELECT tgname, relname, proname 
FROM pg_trigger 
JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid 
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid 
WHERE relname IN ('accounts_wallet', 'accounts_wallettransaction', 'coupons_consumervoucher');
"""

cmd = ["ssh", "-i", ssh_key, "-o", "StrictHostKeyChecking=no", "ubuntu@65.0.40.184", f'sudo -u postgres psql -d trikonekt_staging -c "{sql}"']
res = subprocess.run(cmd, capture_output=True, text=True)
print("TRIGGERS:")
print(res.stdout)

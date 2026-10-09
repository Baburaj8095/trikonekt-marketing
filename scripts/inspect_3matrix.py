import os
import sys
import django

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.db import connection
from accounts.models import CustomUser, WalletTransaction
from business.models import CommissionConfig, AutoPoolAccount
from business.services.commission_policy import CommissionPolicy

u = CustomUser.objects.filter(username="9999999999").first()

print("--- 3-MATRIX AUTOPOOL TRANSACTIONS ---")
with connection.cursor() as c:
    c.execute("""
        SELECT id, type, amount, source_type, source_id, matrix_account_id, meta, created_at 
        FROM accounts_wallettransaction 
        WHERE user_id = %s AND (type LIKE '%%THREE%%' OR meta::text LIKE '%%THREE%%')
    """, [u.id])
    rows = c.fetchall()
    print(f"Total 3-matrix tx count: {len(rows)}")
    for r in rows:
        print("  ", r)

print("\n--- 5-MATRIX AUTOPOOL TRANSACTIONS ---")
with connection.cursor() as c:
    c.execute("""
        SELECT COUNT(*) FROM accounts_wallettransaction 
        WHERE user_id = %s AND (type LIKE '%%FIVE%%' OR meta::text LIKE '%%FIVE%%')
    """, [u.id])
    print("Total 5-matrix tx count:", c.fetchone()[0])

print("\n--- COMMISSION POLICY 3-MATRIX & 5-MATRIX SETTINGS ---")
cfg = CommissionConfig.get_solo()
master = cfg.master_commission_json or {}
print("cm5:", master.get("consumer_matrix_5"))
print("cm3:", master.get("consumer_matrix_3"))
print("monthly_759:", master.get("monthly_759"))
print("prime_750:", master.get("prime_750"))
print("prime_150:", master.get("prime_150"))
print("self_rebirth / self_account:", master.get("self_account"), master.get("self_rebirth"))

print("\n--- AUTOPOOL ACCOUNTS FOR POOL THREE_150 ---")
for ap in AutoPoolAccount.objects.filter(owner=u, pool_type="THREE_150")[:10]:
    print(f"AP ID={ap.id} | idx={ap.user_entry_index} | key={ap.username_key} | src={ap.source_type} ({ap.source_id}) | parent={ap.parent_account_id} | lvl={ap.level}")

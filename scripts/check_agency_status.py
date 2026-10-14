import os, sys, django
sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from django.db import connection
from accounts.models import CustomUser, Wallet, WalletAccount, WalletTransaction

cursor = connection.cursor()

# Find agency users
agency_users = CustomUser.objects.filter(username__icontains="agency")
print(f"Agency users found: {agency_users.count()}")
for u in agency_users:
    w = Wallet.objects.filter(user=u).first()
    wa_list = WalletAccount.objects.filter(user=u)
    tx_cnt = WalletTransaction.objects.filter(user=u).count()
    print(f"Agency User {u.id} ({u.username}):")
    if w:
        print(f"  Wallet: main={getattr(w, 'main_balance', 0)}, bal={getattr(w, 'balance', 0)}, earn={getattr(w, 'total_earnings', 0)}")
        franchise_fields = [f.name for f in w._meta.fields if 'franchise' in f.name]
        for f in franchise_fields:
            val = getattr(w, f, 0)
            if val != 0:
                print(f"    {f}: {val}")
    print(f"  WalletAccounts count: {wa_list.count()}, non-zero: {wa_list.filter(current_balance__gt=0).count()}")
    print(f"  WalletTransactions count: {tx_cnt}")

# Check any other agency or franchise tables in the database
cursor.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND (table_name LIKE '%agency%' OR table_name LIKE '%franchise%' OR table_name LIKE '%geo%');
""")
tables = cursor.fetchall()
print("\nRelated tables found in DB:")
for (t,) in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {t};")
    cnt = cursor.fetchone()[0]
    print(f"  Table {t}: {cnt} rows")

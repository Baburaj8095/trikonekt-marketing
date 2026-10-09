
from django.db import connection

with connection.cursor() as cur:
    cur.execute('''
        SELECT tgname, tgrelid::regclass
        FROM pg_trigger
        WHERE tgrelid IN ('accounts_financialtransaction'::regclass, 'accounts_wallettransaction'::regclass, 'accounts_customuser'::regclass);
    ''')
    for row in cur.fetchall():
        print(row)

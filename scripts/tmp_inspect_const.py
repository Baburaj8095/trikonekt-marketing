
from django.db import connection

with connection.cursor() as cur:
    cur.execute('''
        SELECT conname, pg_get_constraintdef(c.oid)
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE conrelid = 'business_autopoolaccount'::regclass;
    ''')
    for row in cur.fetchall():
        print(row)

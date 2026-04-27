"""Postgres activity snapshot (read-only).

Run:
  python manage.py shell < scripts_run/pg_activity.py

This helps diagnose long-running jobs / lock waits.
"""

from django.db import connection


def _rows(sql: str):
    with connection.cursor() as c:
        c.execute(sql)
        return c.fetchall()


print("vendor", connection.vendor)
print("db", connection.settings_dict.get("NAME"))

sql = """
select
  pid,
  usename,
  state,
  wait_event_type,
  wait_event,
  now() - query_start as query_age,
  now() - xact_start as xact_age,
  left(regexp_replace(coalesce(query,''), E'\\s+', ' ', 'g'), 220) as query
from pg_stat_activity
where datname = current_database()
order by query_start nulls last;
"""

rows = _rows(sql)
print("rows", len(rows))
for r in rows:
    print(r)

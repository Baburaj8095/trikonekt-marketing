"""Duplicate check for AutoPoolAccount seats (read-only).

Run:
  backend\.venv\Scripts\python.exe backend\manage.py shell < backend\scripts_run\dup_check_autopool.py

This checks if we have more than one ACTIVE row for the same (owner_id, pool_type, source_id).
"""

from django.db import connection


SQL = """
select count(*)
from (
  select owner_id, pool_type, source_id, count(*) as c
  from business_autopoolaccount
  where status = 'ACTIVE'
    and pool_type in ('FIVE_150','THREE_150')
  group by owner_id, pool_type, source_id
  having count(*) > 1
) t;
"""

SQL_SAMPLE = """
select owner_id, pool_type, source_id, count(*) as c
from business_autopoolaccount
where status = 'ACTIVE'
  and pool_type in ('FIVE_150','THREE_150')
group by owner_id, pool_type, source_id
having count(*) > 1
order by c desc
limit 25;
"""

with connection.cursor() as c:
    c.execute(SQL)
    print("dup_groups_owner_pool_sourceid", c.fetchone()[0])
    c.execute(SQL_SAMPLE)
    rows = c.fetchall()
    print("sample_rows", len(rows))
    for r in rows:
        print(r)

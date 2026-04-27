"""Audit duplicates for *real* purchase-derived sources.

Why:
  We already have some historical duplicates in DB (mostly RECOVERY/TIMELINE_FIX).
  This script checks duplicates for canonical purchase tags that the UI depends on.

Run:
  backend\.venv\Scripts\python.exe backend\manage.py shell -c "exec(open('backend/scripts_run/dup_check_expected_sources.py','r',encoding='utf-8').read())"
"""

from django.db import connection


def q(sql: str):
    with connection.cursor() as c:
        c.execute(sql)
        return c.fetchall()


SQL_COUNT = """
select count(*)
from (
  select owner_id, pool_type, source_type, source_id, count(*) as c
  from business_autopoolaccount
  where status = 'ACTIVE'
    and pool_type in ('FIVE_150','THREE_150')
    and (
      source_type in ('PRIME_750','PRIME_150','SELF_ACCOUNT_250','ECOUPON_150_ACTIVATED')
      or source_type ilike 'MONTHLY_FIRST_SEASON%'
    )
  group by owner_id, pool_type, source_type, source_id
  having count(*) > 1
) t;
"""

SQL_SAMPLE = """
select owner_id, pool_type, source_type, source_id, count(*) as c
from business_autopoolaccount
where status = 'ACTIVE'
  and pool_type in ('FIVE_150','THREE_150')
  and (
    source_type in ('PRIME_750','PRIME_150','SELF_ACCOUNT_250','ECOUPON_150_ACTIVATED')
    or source_type ilike 'MONTHLY_FIRST_SEASON%'
  )
group by owner_id, pool_type, source_type, source_id
having count(*) > 1
order by c desc, owner_id asc
limit 50;
"""

cnt = q(SQL_COUNT)[0][0]
print("dup_groups_expected_sources", cnt)
rows = q(SQL_SAMPLE)
print("sample_rows", len(rows))
for r in rows[:20]:
    print(r)

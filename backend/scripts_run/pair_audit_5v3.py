"""Pair-audit FIVE_150 vs THREE_150 seats for purchase-derived sources.

Goal:
  Identify why total ACTIVE counts in FIVE_150 and THREE_150 differ.

We check, per source group, whether a seat exists in both pools for the same:
  (owner_id, source_type_group, source_id)

Run:
  backend\.venv\Scripts\python.exe backend\manage.py shell -c "exec(open('backend/scripts_run/pair_audit_5v3.py','r',encoding='utf-8').read())"
"""

from django.db import connection


def scalar(sql: str, params=None):
    with connection.cursor() as c:
        c.execute(sql, params or [])
        return c.fetchone()[0]


def rows(sql: str, params=None):
    with connection.cursor() as c:
        c.execute(sql, params or [])
        return c.fetchall()


print("ACTIVE totals (all sources)")
print(
    rows(
        """
        select pool_type, count(*)
        from business_autopoolaccount
        where status='ACTIVE' and pool_type in ('FIVE_150','THREE_150')
        group by pool_type
        order by pool_type
        """
    )
)


SOURCE_GROUPS = [
    # Use parameterized predicates to avoid '%' formatting issues in Django debug wrappers.
    ("PRIME_750", "source_type = %s", ["PRIME_750"]),
    ("SELF_ACCOUNT_250", "source_type = %s", ["SELF_ACCOUNT_250"]),
    ("PRIME_150", "source_type = %s", ["PRIME_150"]),
    ("ECOUPON_150_ACTIVATED", "source_type = %s", ["ECOUPON_150_ACTIVATED"]),
    ("MONTHLY_FIRST_SEASON", "source_type like %s", ["MONTHLY_FIRST_SEASON%"]),
    # Common historical buckets that can cause imbalance
    ("RECOVERY", "source_type = %s", ["RECOVERY"]),
    ("RESTORATION", "source_type = %s", ["RESTORATION"]),
    ("SELF_250_PACK", "source_type = %s", ["SELF_250_PACK"]),
]


for name, where_src, params in SOURCE_GROUPS:
    print("\n===", name, "===")

    miss_five = scalar(
        f"""
        with five as (
            select owner_id, source_id
            from business_autopoolaccount
            where status='ACTIVE' and pool_type='FIVE_150' and {where_src}
        ), three as (
            select owner_id, source_id
            from business_autopoolaccount
            where status='ACTIVE' and pool_type='THREE_150' and {where_src}
        )
        select count(*)
        from three t
        left join five f
          on f.owner_id=t.owner_id and f.source_id=t.source_id
        where f.source_id is null
        """
        ,
        params + params,
    )
    miss_three = scalar(
        f"""
        with five as (
            select owner_id, source_id
            from business_autopoolaccount
            where status='ACTIVE' and pool_type='FIVE_150' and {where_src}
        ), three as (
            select owner_id, source_id
            from business_autopoolaccount
            where status='ACTIVE' and pool_type='THREE_150' and {where_src}
        )
        select count(*)
        from five f
        left join three t
          on t.owner_id=f.owner_id and t.source_id=f.source_id
        where t.source_id is null
        """
        ,
        params + params,
    )

    print("missing_FIVE_150 (exists in THREE_150 only):", miss_five)
    print("missing_THREE_150 (exists in FIVE_150 only):", miss_three)

    # show small sample if any mismatch exists
    if miss_five:
        smp = rows(
            f"""
            with five as (
                select owner_id, source_id
                from business_autopoolaccount
                where status='ACTIVE' and pool_type='FIVE_150' and {where_src}
            ), three as (
                select owner_id, source_id
                from business_autopoolaccount
                where status='ACTIVE' and pool_type='THREE_150' and {where_src}
            )
            select t.owner_id, t.source_id
            from three t
            left join five f
              on f.owner_id=t.owner_id and f.source_id=t.source_id
            where f.source_id is null
            order by t.owner_id
            limit 10
            """
            ,
            params + params,
        )
        print("sample missing_FIVE_150:", smp)
    if miss_three:
        smp = rows(
            f"""
            with five as (
                select owner_id, source_id
                from business_autopoolaccount
                where status='ACTIVE' and pool_type='FIVE_150' and {where_src}
            ), three as (
                select owner_id, source_id
                from business_autopoolaccount
                where status='ACTIVE' and pool_type='THREE_150' and {where_src}
            )
            select f.owner_id, f.source_id
            from five f
            left join three t
              on t.owner_id=f.owner_id and t.source_id=f.source_id
            where t.source_id is null
            order by f.owner_id
            limit 10
            """
            ,
            params + params,
        )
        print("sample missing_THREE_150:", smp)

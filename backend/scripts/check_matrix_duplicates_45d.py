from django.utils import timezone
from datetime import timedelta
from django.db.models import Count
import json

def run():
    from business.models import AutoPoolAccount

    cutoff = timezone.now() - timedelta(days=45)

    # Owners with >1 FIVE_150 in last 45 days
    five_dup = list(
        AutoPoolAccount.objects.filter(pool_type='FIVE_150', created_at__gte=cutoff)
        .values('owner_id')
        .annotate(c=Count('id'))
        .filter(c__gt=1)
    )

    # Owners with >1 THREE_150 in last 45 days
    three_dup = list(
        AutoPoolAccount.objects.filter(pool_type='THREE_150', created_at__gte=cutoff)
        .values('owner_id')
        .annotate(c=Count('id'))
        .filter(c__gt=1)
    )

    # Duplicates that share same source_type+source_id
    qs = AutoPoolAccount.objects.filter(created_at__gte=cutoff).exclude(source_id__in=["", None])
    dup_by_source = list(
        qs.values('owner_id', 'pool_type', 'source_type', 'source_id')
        .annotate(c=Count('id'))
        .filter(c__gt=1)
    )

    # Prepare detailed rows for owners with duplicates (union of owners)
    owner_ids = set([d['owner_id'] for d in five_dup] + [d['owner_id'] for d in three_dup])
    details = []
    if owner_ids:
        details_qs = AutoPoolAccount.objects.filter(owner_id__in=list(owner_ids), created_at__gte=cutoff).values(
            'id', 'owner_id', 'pool_type', 'status', 'level', 'position', 'source_type', 'source_id', 'created_at'
        ).order_by('owner_id', 'created_at')
        details = list(details_qs)

    out = {
        'cutoff': str(cutoff),
        'five_dup_summary': five_dup,
        'three_dup_summary': three_dup,
        'dup_by_source': dup_by_source,
        'details_for_dup_owners': details,
    }

    print(json.dumps(out, default=str, indent=2))


if __name__ == '__main__':
    run()

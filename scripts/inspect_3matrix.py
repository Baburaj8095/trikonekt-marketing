import os, django, sys
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
sys.path.insert(0, "/srv/trikonekt/staging/backend")
django.setup()

from business.models import AutoPoolAccount
fields = [f.name for f in AutoPoolAccount._meta.fields]
print("Fields:", fields)
for a in AutoPoolAccount.objects.filter(pool_type__in=["THREE_150", "FIVE_150"]).order_by("id"):
    parent_user = a.parent_account.owner.username if a.parent_account and a.parent_account.owner else "None"
    print(f"ID #{a.id} ({a.pool_type}): Owner={a.owner.username if a.owner else 'None'}, Parent=#{a.parent_account_id} ({parent_user}), Pos={a.position}, Source={a.source_type}:{a.source_id}")

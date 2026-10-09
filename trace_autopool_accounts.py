import os, sys, django
sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from business.models import AutoPoolAccount
from accounts.models import CustomUser

print("=== ALL THREE_150 ACCOUNTS ===")
for a in AutoPoolAccount.objects.filter(pool_type__in=["THREE_150", "THREE_POOL"]).order_by("id"):
    parent_info = f"ParentID={a.parent_account_id} (ParentOwner={a.parent_account.owner.username})" if a.parent_account else "Parent=None"
    print(f"ID={a.id} | Owner={a.owner.username} (ID {a.owner.id}) | Level={a.level} | Pos={a.position} | {parent_info} | Status={a.status} | SourceType={a.source_type} | Created={a.created_at}")

print("\n=== ALL FIVE_150 ACCOUNTS ===")
for a in AutoPoolAccount.objects.filter(pool_type__in=["FIVE_150", "FIVE_POOL"]).order_by("id"):
    parent_info = f"ParentID={a.parent_account_id} (ParentOwner={a.parent_account.owner.username})" if a.parent_account else "Parent=None"
    print(f"ID={a.id} | Owner={a.owner.username} (ID {a.owner.id}) | Level={a.level} | Pos={a.position} | {parent_info} | Status={a.status} | SourceType={a.source_type} | Created={a.created_at}")

import os, sys

sys.path.append('/srv/trikonekt/staging/backend')
if os.path.exists('/etc/trikonekt/staging-backend.env'):
    with open('/etc/trikonekt/staging-backend.env') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip().strip('"').strip("'")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

import django
django.setup()

from django.contrib.auth import get_user_model
User = get_user_model()

with open('/tmp/out.txt', 'w') as out:
    out.write("--- USERS ---\n")
    for u in User.objects.all().order_by('id'):
        out.write(f"ID={u.id}, username={u.username}, is_staff={u.is_staff}, is_superuser={u.is_superuser}\n")
        if u.username == 'admin-consumer':
            for f in u._meta.fields:
                out.write(f"  {f.name} = {getattr(u, f.name)}\n")

    out.write("\n--- AUTOPOOLS ---\n")
    from business.models import AutoPoolAccount
    for a in AutoPoolAccount.objects.all().order_by('id'):
        out.write(f"ID={a.id}, pool={a.pool_type}, owner={a.owner.username}, source={a.source_type}, index={a.user_entry_index}, pos={a.position}, parent={a.parent_account_id}\n")

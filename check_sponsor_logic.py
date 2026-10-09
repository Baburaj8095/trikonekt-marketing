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

from accounts.models import CustomUser
from business.models import AutoPoolAccount

u81 = CustomUser.objects.filter(username="8095918105").first()
u78 = CustomUser.objects.filter(username="9999999999").first()

print("u81:", u81.id, u81.username)
print("  registered_by:", getattr(u81, "registered_by_id", None))
print("  sponsor:", getattr(u81, "sponsor_id", None))
print("  referred_by:", getattr(u81, "referred_by_id", None))

print("\nThree-pool placement logic check:")
print("AutoPoolAccount._sponsor_start_entry_id_for(u81, 'THREE_150'):", AutoPoolAccount._sponsor_start_entry_id_for(u81, 'THREE_150'))
print("AutoPoolAccount._sponsor_start_entry_id_for(u81, 'FIVE_150'):", AutoPoolAccount._sponsor_start_entry_id_for(u81, 'FIVE_150'))

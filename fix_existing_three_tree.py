import os, sys, django
from decimal import Decimal

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

# Fix existing 3-block accounts in DB
u78 = CustomUser.objects.filter(username="9999999999").first()
u81 = CustomUser.objects.filter(username="8095918105").first()

acc266 = AutoPoolAccount.objects.filter(id=266).first() # 9999999999 base entry
acc268 = AutoPoolAccount.objects.filter(id=268).first() # 9999999999 2nd entry
acc270 = AutoPoolAccount.objects.filter(id=270).first() # 8095918105 1st entry
acc272 = AutoPoolAccount.objects.filter(id=272).first() # 8095918105 2nd entry

print("BEFORE ADJUSTMENT:")
print("266 (78 base): parent=", acc266.parent_account_id if acc266 else None, "pos=", acc266.position if acc266 else None)
print("268 (78 re-entry): parent=", acc268.parent_account_id if acc268 else None, "pos=", acc268.position if acc268 else None)
print("270 (81 base): parent=", acc270.parent_account_id if acc270 else None, "pos=", acc270.position if acc270 else None)
print("272 (81 re-entry): parent=", acc272.parent_account_id if acc272 else None, "pos=", acc272.position if acc272 else None)

# Under 9999999999 (account 266):
# Position 1: 9999999999 re-entry (268)
# Position 2: 8095918105 downline (270)
if acc270 and acc266:
    acc270.parent_account = acc266
    acc270.level = acc266.level + 1
    acc270.position = 2
    acc270.save()
    print("Re-parented 270 (8095918105) under 266 (9999999999) at pos 2!")

if acc272 and acc270:
    acc272.parent_account = acc270
    acc272.level = acc270.level + 1
    acc272.position = 1
    acc272.save()
    print("Re-parented 272 (8095918105 re-entry) under 270 (8095918105) at pos 1!")

print("\nAFTER ADJUSTMENT:")
for a in AutoPoolAccount.objects.filter(pool_type="THREE_150").order_by("id"):
    parent_str = f"ParentID={a.parent_account_id} ({a.parent_account.owner.username})" if a.parent_account else "Parent=None"
    print(f"ID={a.id} | Owner={a.owner.username} | Level={a.level} | Pos={a.position} | {parent_str}")

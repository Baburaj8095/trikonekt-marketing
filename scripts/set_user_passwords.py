import os
import sys

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser

def set_passwords(default_pw="123456"):
    phones = [
        "9999999999",
        "9999999991",
        "9999999992",
        "9999999993",
        "9999999994",
        "9999999995"
    ]
    print(f"=== SETTING PASSWORDS FOR TEST USERS TO: {default_pw} ===")
    for p in phones:
        u = CustomUser.objects.filter(phone=p).first() or CustomUser.objects.filter(username=p).first()
        if u:
            u.set_password(default_pw)
            u.account_active = True
            u.save()
            print(f"• User {u.username} (Phone: {u.phone}) -> Password set to '{default_pw}'")
        else:
            print(f"• User {p} NOT found")

if __name__ == "__main__":
    set_passwords("123456")

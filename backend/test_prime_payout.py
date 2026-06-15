import os
import django
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from accounts.models import CustomUser
from business.services.prime import distribute_prime_150_payouts
from business.models import AutoPoolAccount

def test():
    username = "7975657678"
    pack_index = "5"
    print(f"=== TESTING PAYOUT FOR {username} INDEX {pack_index} ===")
    user = CustomUser.objects.filter(username=username).first()
    if not user:
        print("User not found")
        return

    # Check database state before
    before_5 = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150").count()
    before_3 = AutoPoolAccount.objects.filter(owner=user, pool_type="THREE_150").count()
    print(f"Before: FIVE_150 count={before_5}, THREE_150 count={before_3}")

    try:
        print("Calling distribute_prime_150_payouts...")
        distribute_prime_150_payouts(
            user,
            source={"type": "SELF_250_PACK", "id": str(pack_index)}
        )
        print("distribute_prime_150_payouts completed without error.")
    except Exception as e:
        print(f"distribute_prime_150_payouts raised exception: {e}")
        import traceback
        traceback.print_exc()

    # Check database state after
    after_5 = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150").count()
    after_3 = AutoPoolAccount.objects.filter(owner=user, pool_type="THREE_150").count()
    print(f"After: FIVE_150 count={after_5}, THREE_150 count={after_3}")

if __name__ == "__main__":
    test()

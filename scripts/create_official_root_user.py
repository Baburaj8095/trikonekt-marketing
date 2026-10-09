import os
import sys
from decimal import Decimal

sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from django.utils import timezone
from accounts.models import CustomUser, Wallet
from mlm_ranks.models import Rank, UserRank
from mlm_ranks.services.five_matrix import FiveMatrixService

def create_or_fix_root_user():
    print("==========================================================================")
    print("SETTING UP OFFICIAL ROOT USER: 9999999999 (STANDARD SCHEMA)")
    print("==========================================================================")

    user, _ = CustomUser.objects.get_or_create(
        username="9999999999",
        defaults={
            "phone": "9999999999",
            "full_name": "Trikonekt Root",
            "role": "user",
            "category": "consumer",
            "identity_type": "END_USER",
            "account_active": True,
            "autopool_enabled": True,
            "is_active": True,
        }
    )
    user.set_password("123456")
    user.phone = "9999999999"
    user.full_name = "Trikonekt Root"
    user.role = "user"
    user.category = "consumer"
    user.identity_type = "END_USER"
    user.account_active = True
    user.autopool_enabled = True
    user.is_active = True
    user.save()

    # Setup Wallet
    wallet = Wallet.get_or_create_for_user(user)

    # Setup Rank 1
    r1 = Rank.objects.filter(level_number=1).first()
    if r1:
        ur, _ = UserRank.objects.get_or_create(user=user, defaults={"current_rank": r1})
        ur.current_rank = r1
        ur.direct_count = 0
        ur.total_team_size = 0
        ur.achieved_at = timezone.now()
        ur.save()

    # Ensure Rank 1 Matrix Root is initialized
    root_matrix = FiveMatrixService.ensure_root_for_rank1(user)

    print(f"✔ User ID: {user.id}")
    print(f"✔ Username: {user.username}")
    print(f"✔ Phone: {user.phone}")
    print(f"✔ Role: {user.role}")
    print(f"✔ Category: {user.category}")
    print(f"✔ Identity Type: {user.identity_type}")
    print(f"✔ Password verified: {user.check_password('123456')}")
    print(f"✔ Rank: {r1.rank_name if r1 else 'None'}")
    print(f"✔ Matrix Root ID: {root_matrix.id if root_matrix else 'None'}")
    print(f"✔ Wallet Balance: ₹{wallet.balance}")
    print("==========================================================================")
    print("OFFICIAL ROOT USER READY AND CONFIGURED FOR ASIA / TRIKONEKT LOGIN")
    print("==========================================================================")

if __name__ == "__main__":
    create_or_fix_root_user()

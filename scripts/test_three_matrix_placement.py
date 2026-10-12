import sys
import os

env_path = "/etc/trikonekt/staging-backend.env"
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

sys.path.insert(0, "/srv/trikonekt/staging/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from decimal import Decimal
from django.db import transaction
from accounts.models import CustomUser
from business.models import AutoPoolAccount

u_root = CustomUser.objects.filter(username="9999999999").first()
u_cand = CustomUser.objects.filter(username="8095918105").first()
u_third = CustomUser.objects.exclude(username__in=["9999999999", "8095918105"]).first()

print("=== TESTING EMPTY TREE & PROGRESSIVE PLACEMENT (DRY-RUN / ROLLBACK) ===")

with transaction.atomic():
    # Ensure empty tree in transaction
    AutoPoolAccount.objects.all().delete()

    print("\n--- STEP 1: Tree is EMPTY ---")
    print("AutoPoolAccount count:", AutoPoolAccount.objects.count())

    print("\n--- STEP 2: First user 9999999999 buys 2k ---")
    # 2.1 Prime 750 (5-Matrix & 3-Matrix)
    p5_root = AutoPoolAccount.place_in_five_pool(u_root, "FIVE_150", Decimal("750.00"), source_type="PRIME_750", source_id="COUPON_1")
    p3_root = AutoPoolAccount.place_in_three_pool(u_root, "THREE_150", Decimal("750.00"), source_type="PRIME_750", source_id="COUPON_1")
    print(f"5-Matrix Root: ID={p5_root.id}, owner={p5_root.owner.username}, parent={p5_root.parent_account_id}, level={p5_root.level}, pos={p5_root.position}, entry_idx={p5_root.user_entry_index}")
    print(f"3-Matrix Root: ID={p3_root.id}, owner={p3_root.owner.username}, parent={p3_root.parent_account_id}, level={p3_root.level}, pos={p3_root.position}, entry_idx={p3_root.user_entry_index}")

    assert p5_root.parent_account is None and p5_root.level == 0 and p5_root.position is None, "5-Matrix root must be level 0 parent=None"
    assert p3_root.parent_account is None and p3_root.level == 0 and p3_root.position is None, "3-Matrix root must be level 0 parent=None"

    # 2.2 SPP 1000
    spp5_root = AutoPoolAccount.place_in_five_pool(u_root, "FIVE_150", Decimal("1000.00"), source_type="SPP_1000", source_id="SPP_1")
    spp3_root = AutoPoolAccount.place_in_three_pool(u_root, "THREE_150", Decimal("1000.00"), source_type="SPP_1000", source_id="SPP_1")
    print(f"5-Matrix SPP (9999999999): ID={spp5_root.id}, parent={spp5_root.parent_account_id} (owner={spp5_root.parent_account.owner.username}), level={spp5_root.level}, pos={spp5_root.position}, entry_idx={spp5_root.user_entry_index}")
    print(f"3-Matrix SPP (9999999999): ID={spp3_root.id}, parent={spp3_root.parent_account_id} (owner={spp3_root.parent_account.owner.username}), level={spp3_root.level}, pos={spp3_root.position}, entry_idx={spp3_root.user_entry_index}")

    assert spp5_root.parent_account_id == p5_root.id and spp5_root.position == 1, "5-Matrix SPP must be sub ID under 9999999999 prime root"
    assert spp3_root.parent_account_id == p3_root.id and spp3_root.position == 1, "3-Matrix SPP must fill slot 1 under 3-matrix root"

    print("\n--- STEP 3: Second user 8095918105 buys 2k ---")
    p5_u2 = AutoPoolAccount.place_in_five_pool(u_cand, "FIVE_150", Decimal("750.00"), source_type="PRIME_750", source_id="COUPON_2")
    p3_u2 = AutoPoolAccount.place_in_three_pool(u_cand, "THREE_150", Decimal("750.00"), source_type="PRIME_750", source_id="COUPON_2")
    print(f"5-Matrix Prime (8095918105): ID={p5_u2.id}, parent={p5_u2.parent_account_id} (owner={p5_u2.parent_account.owner.username}), level={p5_u2.level}, pos={p5_u2.position}")
    print(f"3-Matrix Prime (8095918105): ID={p3_u2.id}, parent={p3_u2.parent_account_id} (owner={p3_u2.parent_account.owner.username}), level={p3_u2.level}, pos={p3_u2.position}")

    assert p5_u2.parent_account_id == p5_root.id and p5_u2.position == 2, "5-Matrix Prime for user 2 must fill position 2 under 9999999999 root"
    assert p3_u2.parent_account_id == p3_root.id and p3_u2.position == 2, "3-Matrix Prime for user 2 must fill position 2 under 9999999999 root"

    spp5_u2 = AutoPoolAccount.place_in_five_pool(u_cand, "FIVE_150", Decimal("1000.00"), source_type="SPP_1000", source_id="SPP_2")
    spp3_u2 = AutoPoolAccount.place_in_three_pool(u_cand, "THREE_150", Decimal("1000.00"), source_type="SPP_1000", source_id="SPP_2")
    print(f"5-Matrix SPP (8095918105): ID={spp5_u2.id}, parent={spp5_u2.parent_account_id} (owner={spp5_u2.parent_account.owner.username}), level={spp5_u2.level}, pos={spp5_u2.position}")
    print(f"3-Matrix SPP (8095918105): ID={spp3_u2.id}, parent={spp3_u2.parent_account_id} (owner={spp3_u2.parent_account.owner.username}), level={spp3_u2.level}, pos={spp3_u2.position}")

    assert spp5_u2.parent_account_id == p5_u2.id and spp5_u2.position == 1, "5-Matrix SPP for user 2 MUST be sub ID under 8095918105's own prime entry!"
    assert spp3_u2.parent_account_id == p3_root.id and spp3_u2.position == 3, "3-Matrix SPP for user 2 MUST fill position 3 under Root (NOT under parent)!"

    print("\n--- STEP 4: Third user 9999999998 buys 2k ---")
    p3_u3 = AutoPoolAccount.place_in_three_pool(u_third, "THREE_150", Decimal("750.00"), source_type="PRIME_750", source_id="COUPON_3")
    spp3_u3 = AutoPoolAccount.place_in_three_pool(u_third, "THREE_150", Decimal("1000.00"), source_type="SPP_1000", source_id="SPP_3")
    print(f"3-Matrix Prime (User 3): ID={p3_u3.id}, parent={p3_u3.parent_account_id} (owner={p3_u3.parent_account.owner.username}), level={p3_u3.level}, pos={p3_u3.position}")
    print(f"3-Matrix SPP   (User 3): ID={spp3_u3.id}, parent={spp3_u3.parent_account_id} (owner={spp3_u3.parent_account.owner.username}), level={spp3_u3.level}, pos={spp3_u3.position}")

    assert p3_u3.parent_account_id == spp3_root.id and p3_u3.position == 1, "Level 1 is full, User 3 Prime must go to Level 2 (Pos 1 under node 1)!"
    assert spp3_u3.parent_account_id == spp3_root.id and spp3_u3.position == 2, "User 3 SPP must go to Level 2 (Pos 2 under node 1)!"

    print("\n=== ALL ASSERTIONS PASSED PERFECTLY! ===")
    transaction.set_rollback(True)

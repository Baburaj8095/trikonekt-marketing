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

print("=== TESTING 3-MATRIX AUTO POOL PLACEMENT (DRY-RUN / TRANSACTION ROLLBACK) ===")

with transaction.atomic():
    # 1. Root buys Prime -> Account 3
    a1 = AutoPoolAccount.place_in_three_pool(u_root, "THREE_150", Decimal("150.00"), source_type="PRIME_750", source_id="TEST_ROOT_PRIME")
    print(f"1. 9999999999 Prime placed: ID={a1.id}, parent_id={a1.parent_account_id}, pos={a1.position}, level={a1.level}")

    # 2. Root buys SPP -> Account 4
    a2 = AutoPoolAccount.place_in_three_pool(u_root, "THREE_150", Decimal("150.00"), source_type="SPP_1000", source_id="TEST_ROOT_SPP")
    print(f"2. 9999999999 SPP placed: ID={a2.id}, parent_id={a2.parent_account_id}, pos={a2.position}, level={a2.level}")

    # 3. 8095918105 buys Prime -> Account 5
    a3 = AutoPoolAccount.place_in_three_pool(u_cand, "THREE_150", Decimal("150.00"), source_type="PRIME_750", source_id="TEST_CAND_PRIME")
    print(f"3. 8095918105 Prime placed: ID={a3.id}, parent_id={a3.parent_account_id}, pos={a3.position}, level={a3.level}")

    # Level 1 under Sentinel Root (ID 2) is now FULL with 3 children: [a1.id, a2.id, a3.id]

    # 4. 8095918105 buys SPP (2nd entry of 8095918105)
    a4 = AutoPoolAccount.place_in_three_pool(u_cand, "THREE_150", Decimal("150.00"), source_type="SPP_1000", source_id="TEST_CAND_SPP")
    print(f"4. 8095918105 SPP placed: ID={a4.id}, parent_id={a4.parent_account_id} (owner={a4.parent_account.owner.username}), pos={a4.position}, level={a4.level}")

    # Verification: Did a4 go under a1 (Slot 1 of Level 1) instead of under a3 (8095918105's own entry)?
    if a4.parent_account_id == a1.id and a4.position == 1 and a4.level == 2:
        print("SUCCESS! Entry 4 went strictly under first Level-1 node (left-to-right BFS auto pool rule), NOT under 8095918105!")
    else:
        print(f"FAILURE: Parent was {a4.parent_account_id}, expected {a1.id}!")

    # Roll back transaction so database remains pristine
    transaction.set_rollback(True)
    print("Transaction rolled back successfully. Database remains pristine.")

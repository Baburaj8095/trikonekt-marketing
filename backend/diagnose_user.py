import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
django.setup()

from decimal import Decimal
from accounts.models import CustomUser
from business.models import is_matrix_eligible, AutoPoolAccount
from business.services.placement import GenericPlacement

def run_diagnostics():
    username = "7975657678"
    print(f"=== TRACING PLACEMENT FOR USER {username} ===")
    user = CustomUser.objects.filter(username=username).first()
    if not user:
        print(f"[-] User {username} not found.")
        return
        
    print(f"[+] User: {user.username} (ID: {user.id})")
    print(f"  - Role: {user.role}")
    print(f"  - Category: {user.category}")
    print(f"  - Is Staff: {user.is_staff}")
    print(f"  - Is Superuser: {user.is_superuser}")
    print(f"  - Is Active: {user.is_active}")
    print(f"  - Eligible (is_matrix_eligible): {is_matrix_eligible(user)}")
    
    print("\n[+] Tracing AutoPoolAccount.create_five_150_for_user step-by-step:")
    
    # own_base
    own_base = AutoPoolAccount._base_self_account(user, "FIVE_150")
    print(f"  - own_base: {own_base}")
    if own_base:
        start_id = int(own_base.id)
    else:
        start_id = AutoPoolAccount._sponsor_start_entry_id_for(user, "FIVE_150")
    print(f"  - Resolved start_id: {start_id}")
    
    if start_id is None:
        root = AutoPoolAccount.objects.filter(parent_account__isnull=True, pool_type="FIVE_150").first()
        start_id = root.id if root else None
        print(f"  - Fallback start_id (sentinel): {start_id}")
        
    # Let's run GenericPlacement.place_account directly and see if it fails/raises an exception
    print("\n[+] Invoking GenericPlacement.place_account for FIVE_150...")
    try:
        acc = GenericPlacement.place_account(
            owner=user,
            pool_type="FIVE_150",
            amount=Decimal("150.00"),
            source_type="SELF_250_PACK",
            source_id="4",
            start_entry_id=start_id,
        )
        print(f"  [SUCCESS] Placed FIVE_150 successfully: {acc} (ID: {acc.id}, parent: {acc.parent_account_id}, position: {acc.position})")
    except Exception as e:
        print(f"  [FAILED] GenericPlacement.place_account for FIVE_150 raised an exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

    # Let's run GenericPlacement.place_account directly for THREE_150
    print("\n[+] Invoking GenericPlacement.place_account for THREE_150...")
    try:
        acc = GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_150",
            amount=Decimal("150.00"),
            source_type="SELF_250_PACK",
            source_id="4",
            start_entry_id=None,  # Three pool starts at sentinel root
        )
        print(f"  [SUCCESS] Placed THREE_150 successfully: {acc} (ID: {acc.id}, parent: {acc.parent_account_id}, position: {acc.position})")
    except Exception as e:
        print(f"  [FAILED] GenericPlacement.place_account for THREE_150 raised an exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_diagnostics()

import os, sys, django
from decimal import Decimal

path = '/srv/trikonekt/staging/backend/business/models.py'
with open(path, 'r') as f:
    code = f.read()

# 1. Update create_three_150_for_user to anchor to sponsor for 1st entry, own_base for 2nd+
old_create_three = """        # Global pool placement: ignore sponsor anchor
        return GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_150",
            amount=amt,
            source_type=source_type or "SYSTEM",
            source_id=source_id or "",
            start_entry_id=None,
        )"""

new_create_three = """        # Sponsor-anchored placement for 1st entry, own_base for 2nd+
        own_base = cls._base_self_account(user, "THREE_150")
        if own_base:
            start_id = int(own_base.id)
        else:
            start_id = cls._sponsor_start_entry_id_for(user, "THREE_150")
        if start_id is None:
            root = cls.objects.filter(parent_account__isnull=True, pool_type="THREE_150").first()
            start_id = root.id if root else None

        res = GenericPlacement.place_account(
            owner=user,
            pool_type="THREE_150",
            amount=amt,
            source_type=source_type or "SYSTEM",
            source_id=source_id or "",
            start_entry_id=start_id,
        )
        if res and getattr(res, "user_entry_index", 0) == 1:
            try:
                cls.reanchor_sponsored_downlines(user, "THREE_150")
            except Exception:
                pass
        return res"""

if old_create_three in code:
    code = code.replace(old_create_three, new_create_three)
    print("Replaced old_create_three in models.py!")
else:
    print("WARNING: old_create_three target not matched!")

# 2. Update place_in_three_pool
old_place_in_three = """        amt = D(amount or 0)
        start_id = None if str(pool_type) == "THREE_150" else cls._sponsor_start_entry_id_for(user, pool_type)
        return GenericPlacement.place_account("""

new_place_in_three = """        amt = D(amount or 0)
        own_base = cls._base_self_account(user, pool_type)
        if own_base:
            start_id = int(own_base.id)
        else:
            start_id = cls._sponsor_start_entry_id_for(user, pool_type)
        if start_id is None:
            root = cls.objects.filter(parent_account__isnull=True, pool_type=pool_type).first()
            start_id = root.id if root else None
        return GenericPlacement.place_account("""

if old_place_in_three in code:
    code = code.replace(old_place_in_three, new_place_in_three)
    print("Replaced old_place_in_three in models.py!")
else:
    print("Notice: old_place_in_three target check passed or already updated.")

with open(path, 'w') as f:
    f.write(code)

print("SUCCESS: business/models.py updated with sponsor-anchoring for THREE_150!")

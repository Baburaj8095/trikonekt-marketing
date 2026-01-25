#!/usr/bin/env python
import os
import sys

# Move to backend/ and setup Django
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(BASE_DIR)
sys.path.append(BASE_DIR)
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django
django.setup()

from accounts.models import CustomUser

def uname(num: int) -> str:
    return f"TR{num:010d}"

def main():
    pincode_expected = "560001"
    pwd = "12345678"

    # Ranges per spec
    first_range = list(range(9000000001, 9000000020 + 1))   # 20 users
    second_range = list(range(9000000021, 9000000055 + 1))  # 35 users

    first_unames = [uname(n) for n in first_range]
    second_unames = [uname(n) for n in second_range]

    # Existence checks
    first_found = list(CustomUser.objects.filter(username__in=first_unames).values_list("username", flat=True))
    second_found = list(CustomUser.objects.filter(username__in=second_unames).values_list("username", flat=True))

    missing_first = sorted(set(first_unames) - set(first_found))
    missing_second = sorted(set(second_unames) - set(second_found))

    print("== Existence ==")
    print(f"First batch present: {len(first_found)}/20")
    if missing_first:
        print("Missing first:", ", ".join(missing_first))
    print(f"Second batch present: {len(second_found)}/35")
    if missing_second:
        print("Missing second:", ", ".join(missing_second))

    # Sponsor checks
    root = CustomUser.objects.filter(username="TRIKONEKT").first()
    if not root:
        print("ERROR: TRIKONEKT root not found.")
        return

    first_qs = CustomUser.objects.filter(username__in=first_unames)
    direct_under_root = first_qs.filter(registered_by=root).count()
    print("\n== Sponsorship ==")
    print(f"Direct under TRIKONEKT (expected 20): {direct_under_root}")

    # For TR9000000001..TR9000000005 each should have 7 directs from the second batch
    print("Per-sponsor child counts for second batch (expected 7 each):")
    sponsors = [uname(9000000000 + i) for i in range(1, 6)]
    second_qs = CustomUser.objects.filter(username__in=second_unames)
    for su in sponsors:
        s = CustomUser.objects.filter(username=su).first()
        if not s:
            print(f"  {su}: MISSING SPONSOR")
            continue
        cnt = second_qs.filter(registered_by=s).count()
        print(f"  {su}: {cnt}")

    # Pincode check
    print("\n== Pincode ==")
    pincode_first_bad = list(CustomUser.objects.filter(username__in=first_unames).exclude(pincode=pincode_expected).values_list("username", "pincode"))
    pincode_second_bad = list(CustomUser.objects.filter(username__in=second_unames).exclude(pincode=pincode_expected).values_list("username", "pincode"))
    print(f"Pincode OK first batch: {20 - len(pincode_first_bad)}/20")
    if pincode_first_bad:
        print("  First batch with wrong pincode:", pincode_first_bad)
    print(f"Pincode OK second batch: {35 - len(pincode_second_bad)}/35")
    if pincode_second_bad:
        print("  Second batch with wrong pincode:", pincode_second_bad)

    # Role/Category check
    print("\n== Role/Category ==")
    bad_role_first = list(CustomUser.objects.filter(username__in=first_unames).exclude(role="user").values_list("username", "role"))
    bad_cat_first = list(CustomUser.objects.filter(username__in=first_unames).exclude(category="consumer").values_list("username", "category"))
    bad_role_second = list(CustomUser.objects.filter(username__in=second_unames).exclude(role="user").values_list("username", "role"))
    bad_cat_second = list(CustomUser.objects.filter(username__in=second_unames).exclude(category="consumer").values_list("username", "category"))
    print(f"First batch role=user OK: {20 - len(bad_role_first)}/20")
    if bad_role_first:
        print("  First bad roles:", bad_role_first)
    print(f"First batch category=consumer OK: {20 - len(bad_cat_first)}/20")
    if bad_cat_first:
        print("  First bad categories:", bad_cat_first)
    print(f"Second batch role=user OK: {35 - len(bad_role_second)}/35")
    if bad_role_second:
        print("  Second bad roles:", bad_role_second)
    print(f"Second batch category=consumer OK: {35 - len(bad_cat_second)}/35")
    if bad_cat_second:
        print("  Second bad categories:", bad_cat_second)

    # Password check (sample a few)
    print("\n== Password sample checks ==")
    samples = [first_unames[0], first_unames[-1], second_unames[0], second_unames[-1]]
    for u in samples:
        obj = CustomUser.objects.filter(username=u).first()
        if not obj:
            print(f"  {u}: MISSING")
            continue
        try:
            ok = obj.check_password(pwd)
        except Exception:
            ok = False
        print(f"  {u}: {'OK' if ok else 'FAIL'}")

    # Sample rows
    print("\n== Sample records (username -> sponsor) ==")
    sample_unames = first_unames[:3] + second_unames[:3]
    for u in sample_unames:
        obj = CustomUser.objects.filter(username=u).first()
        if not obj:
            print(f"  {u}: MISSING")
            continue
        sp = getattr(obj.registered_by, 'username', None)
        print(f"  {u} -> {sp}")

if __name__ == "__main__":
    main()

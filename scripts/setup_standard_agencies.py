import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from run_remote_helper import run_remote

script_content = """
from accounts.models import CustomUser, AgencyRegionAssignment, Wallet
from locations.models import State

state_kar = State.objects.filter(name__iexact='Karnataka').first() or State.objects.get(id=1)
state_goa = State.objects.filter(name__iexact='Goa').first() or State.objects.get(id=4009)

print('Using State Karnataka:', state_kar.id, state_kar.name)
print('Using State Goa:', state_goa.id, state_goa.name)

# 1. Clean existing agency users
old_phones = ['9611443183', '8296532730', '9999945888', '9686570448', 
              '9800000001', '9800000002', '9800000003', '9800000004', '9800000005', '9800000006']

for p in old_phones:
    users = CustomUser.objects.filter(phone=p)
    for u in users:
        print(f"Deleting user {u.id} ({u.phone}, {u.category})...")
        AgencyRegionAssignment.objects.filter(user=u).delete()
        Wallet.objects.filter(user=u).delete()
        u.delete()

# Also clean any leftover region assignments without user
AgencyRegionAssignment.objects.filter(user__isnull=True).delete()

# 2. Setup standard 6 Agency users
agency_specs = [
    {
        "phone": "9800000001",
        "username": "agency_pincode_572106",
        "full_name": "Savitri Biradar",
        "category": "agency_pincode",
        "role": "agency",
        "pincode": "572106",
        "state": state_kar,
        "assignments": [
            {"level": "pincode", "pincode": "572106", "district": "Tumakuru", "state": state_kar}
        ]
    },
    {
        "phone": "9800000002",
        "username": "agency_pincode_coord",
        "full_name": "Rajesh Hegde",
        "category": "agency_pincode_coordinator",
        "role": "agency",
        "pincode": "572106",
        "state": state_kar,
        "assignments": [
            {"level": "pincode", "pincode": "572106", "district": "Tumakuru", "state": state_kar},
            {"level": "pincode", "pincode": "572101", "district": "Tumakuru", "state": state_kar},
            {"level": "pincode", "pincode": "572102", "district": "Tumakuru", "state": state_kar},
            {"level": "pincode", "pincode": "572103", "district": "Tumakuru", "state": state_kar},
        ]
    },
    {
        "phone": "9800000003",
        "username": "agency_district_tumakuru",
        "full_name": "Mahesh Patil",
        "category": "agency_district",
        "role": "agency",
        "pincode": "572101",
        "state": state_kar,
        "assignments": [
            {"level": "district", "district": "Tumakuru", "state": state_kar}
        ]
    },
    {
        "phone": "9800000004",
        "username": "agency_district_coord",
        "full_name": "Anand Shettar",
        "category": "agency_district_coordinator",
        "role": "agency",
        "pincode": "572101",
        "state": state_kar,
        "assignments": [
            {"level": "district", "district": "Tumakuru", "state": state_kar},
            {"level": "district", "district": "Hassan", "state": state_kar},
        ]
    },
    {
        "phone": "9800000005",
        "username": "agency_state_karnataka",
        "full_name": "Kavitha Gowda",
        "category": "agency_state",
        "role": "agency",
        "pincode": "560001",
        "state": state_kar,
        "assignments": [
            {"level": "state", "state": state_kar}
        ]
    },
    {
        "phone": "9800000006",
        "username": "agency_state_coord",
        "full_name": "Siddharth Varma",
        "category": "agency_state_coordinator",
        "role": "agency",
        "pincode": "560001",
        "state": state_kar,
        "assignments": [
            {"level": "state", "state": state_kar},
            {"level": "state", "state": state_goa},
        ]
    },
]

created_users = []
for spec in agency_specs:
    u = CustomUser.objects.create(
        phone=spec["phone"],
        username=spec["username"],
        full_name=spec["full_name"],
        category=spec["category"],
        role=spec["role"],
        pincode=spec.get("pincode", ""),
        state=spec.get("state"),
        is_active=True,
        account_active=True,
    )
    u.set_password("Trikonekt@2026!")
    u.save()
    
    # Initialize wallet
    w = Wallet.get_or_create_for_user(u)
    w.balance = 0
    w.main_balance = 0
    w.withdrawable_balance = 0
    w.self_account_balance = 0
    w.save()

    # Region assignments
    for ass in spec["assignments"]:
        AgencyRegionAssignment.objects.create(
            user=u,
            level=ass.get("level"),
            pincode=ass.get("pincode", ""),
            district=ass.get("district", ""),
            state=ass.get("state"),
        )
    created_users.append(u)
    print(f"Created Agency: ID={u.id}, Phone={u.phone}, Category={u.category}, Username={u.username}")

print(f"\\nSuccessfully created {len(created_users)} standard agency users!")
"""

if __name__ == "__main__":
    run_remote(script_content)

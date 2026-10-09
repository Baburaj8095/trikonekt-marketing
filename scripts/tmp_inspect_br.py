
from business.models import BusinessRegistration, FranchisePayout
from accounts.models import AgencyRegionAssignment, WalletAccount

print("--- BusinessRegistration fields ---")
for f in BusinessRegistration._meta.get_fields():
    if not f.is_relation or f.many_to_one:
        print("  ", f.name)

print("Total BusinessRegistrations in DB:", BusinessRegistration.objects.count())
for b in BusinessRegistration.objects.all()[:5]:
    print("  Merchant:", b.id, getattr(b, "business_name", ""), getattr(b, "owner_name", ""), getattr(b, "pincode", ""), getattr(b, "mobile_number", ""))

print("--- FranchisePayout fields ---")
for f in FranchisePayout._meta.get_fields():
    if not f.is_relation or f.many_to_one:
        print("  ", f.name)

print("Total FranchisePayout in DB:", FranchisePayout.objects.count())
for fp in FranchisePayout.objects.all()[:5]:
    print("  Payout:", fp.id, getattr(fp, "user", ""), getattr(fp, "amount", ""), getattr(fp, "tier", ""))

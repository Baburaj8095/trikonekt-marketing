
from accounts.models import CustomUser

print("--- CustomUser fields ---")
for f in CustomUser._meta.get_fields():
    if not f.is_relation:
        if any(w in f.name.lower() for w in ['role', 'cat', 'type', 'cap', 'is_', 'agency', 'fran']):
            print("  ", f.name)

print("Unique categories in CustomUser:", list(CustomUser.objects.values_list('category', flat=True).distinct()))
print("Unique roles in CustomUser:", list(CustomUser.objects.values_list('role', flat=True).distinct()) if hasattr(CustomUser, 'role') else "No role field")

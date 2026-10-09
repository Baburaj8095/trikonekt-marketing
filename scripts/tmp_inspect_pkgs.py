
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'trikonekt.settings')
django.setup()
from business.models import PromoPackage
for p in PromoPackage.objects.all():
    print(f'{p.id} | {p.code} | {p.name} | {p.price} | {p.type} | {p.is_active}')

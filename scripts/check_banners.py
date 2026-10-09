import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import TeamConsumerWishingBanner

qs = TeamConsumerWishingBanner.objects.filter(is_active=True)
print("ACTIVE BANNERS IN DB:", qs.count())
for b in qs:
    print(b.id, b.title, b.image)

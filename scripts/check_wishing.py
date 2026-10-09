import os, sys, json

sys.path.append("/srv/trikonekt/staging/backend")
if os.path.exists("/etc/trikonekt/staging-backend.env"):
    with open("/etc/trikonekt/staging-backend.env") as f:
        for line in f:
            if line.strip() and not line.startswith("#") and "=" in line:
                k, v = line.strip().split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'\"")

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django
django.setup()

from business.models import TeamConsumerWishingBanner
from business.serializers import TeamConsumerWishingBannerSerializer

print(f"=== TeamConsumerWishingBanner Count: {TeamConsumerWishingBanner.objects.count()} ===")
for b in TeamConsumerWishingBanner.objects.all():
    print(f"ID: {b.id}, Title: {b.title}, Active: {b.is_active}")
    print(f"  image: {b.image}")
    ser = TeamConsumerWishingBannerSerializer(b)
    print("  serialized:", ser.data)

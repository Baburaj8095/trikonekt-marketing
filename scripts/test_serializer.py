import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from business.models import TeamConsumerTopAchiever
from business.serializers import TeamConsumerTopAchieverSerializer

qs = TeamConsumerTopAchiever.objects.filter(is_active=True).order_by("sort_order", "-created_at", "id")
ser = TeamConsumerTopAchieverSerializer(qs, many=True)
print("SERIALIZED RESULTS COUNT:", len(ser.data))
for row in ser.data:
    print(row)

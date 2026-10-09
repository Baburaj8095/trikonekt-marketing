import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.conf import settings
print("ENGINE:", settings.DATABASES['default']['ENGINE'])
print("NAME:", settings.DATABASES['default']['NAME'])


import django
django.setup()
from django.apps import apps

print("=== APPS AND MODELS ===")
for app in ['business', 'accounts', 'core']:
    try:
        app_config = apps.get_app_config(app)
        print(f"App: {app}")
        for m in app_config.get_models():
            print(f"  Model: {m.__name__}")
    except Exception as e:
        print(f"Error {app}: {e}")

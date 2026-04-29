from django.apps import AppConfig


class BusinessConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'business'
    verbose_name = 'Business Registration'

    def ready(self):
        # Ensure hubble models are registered
        try:
            from . import hubble_models  # noqa: F401
        except Exception:
            pass

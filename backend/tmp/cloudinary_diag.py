import os
import sys

# Ensure Django settings are loaded
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
try:
    import django
    django.setup()
except Exception as e:
    print(f"django.setup() error: {e}")

from django.conf import settings

lines = []
lines.append(f"CLOUDINARY_URL present: {bool(os.environ.get('CLOUDINARY_URL'))}")
lines.append(f"DEFAULT_FILE_STORAGE setting: {getattr(settings, 'DEFAULT_FILE_STORAGE', '')}")
lines.append(f"cloudinary_storage in INSTALLED_APPS: {'cloudinary_storage' in getattr(settings, 'INSTALLED_APPS', [])}")
lines.append(f"cloudinary in INSTALLED_APPS: {'cloudinary' in getattr(settings, 'INSTALLED_APPS', [])}")

# Import checks
try:
    import cloudinary  # type: ignore
    ver = getattr(cloudinary, "__version__", "OK")
    lines.append(f"cloudinary import: OK ({ver})")
except Exception as e:
    lines.append(f"cloudinary import error: {e!r}")

try:
    import cloudinary_storage.storage as cs  # type: ignore
    lines.append(f"cloudinary_storage import: OK")
    lines.append(f"MediaCloudinaryStorage class resolved to: {cs.MediaCloudinaryStorage.__module__}.{cs.MediaCloudinaryStorage.__name__}")
except Exception as e:
    lines.append(f"cloudinary_storage import error: {e!r}")

# Default storage class
try:
    from django.core.files.storage import default_storage
    lines.append(f"default_storage class: {default_storage.__class__.__module__}.{default_storage.__class__.__name__}")
except Exception as e:
    lines.append(f"default_storage error: {e!r}")

# Avatar field storage class
try:
    from accounts.models import CustomUser
    storage_cls = type(CustomUser._meta.get_field("avatar").storage)
    lines.append(f"accounts.CustomUser.avatar storage class: {storage_cls.__module__}.{storage_cls.__name__}")
except Exception as e:
    lines.append(f"avatar storage introspection error: {e!r}")

# Write to file and stdout
out_path = os.path.join(os.path.dirname(__file__), "cloudinary_diag.txt")
try:
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
except Exception as e:
    print(f"failed to write diag file: {e!r}")

print("\n".join(lines))

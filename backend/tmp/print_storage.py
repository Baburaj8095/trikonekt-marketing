import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

lines = []
try:
    import django
    django.setup()
    setup_err = None
except Exception as e:
    setup_err = f"django.setup() error: {e!r}"

from django.conf import settings

lines.append(f"CLOUDINARY_URL present: {bool(os.environ.get('CLOUDINARY_URL'))}")
lines.append(f"DEFAULT_FILE_STORAGE: {getattr(settings, 'DEFAULT_FILE_STORAGE', None)}")
lines.append(f"'cloudinary_storage' in INSTALLED_APPS: {'cloudinary_storage' in getattr(settings, 'INSTALLED_APPS', [])}")
lines.append(f"'cloudinary' in INSTALLED_APPS: {'cloudinary' in getattr(settings, 'INSTALLED_APPS', [])}")

# cloudinary_storage shim diagnostics
try:
    import cloudinary_storage.storage as cs  # type: ignore
    lines.append(f"cloudinary_storage.storage module: {getattr(cs, '__file__', None)}")
    try:
        mcs = cs.MediaCloudinaryStorage
        lines.append(f"MediaCloudinaryStorage resolved to: {mcs.__module__}.{mcs.__name__}")
        lines.append("MediaCloudinaryStorage MRO: " + " -> ".join([c.__module__ + "." + c.__name__ for c in mcs.__mro__]))
    except Exception as e:
        lines.append(f"MediaCloudinaryStorage access error: {e!r}")
except Exception as e:
    lines.append(f"cloudinary_storage import error: {e!r}")

# default storage
try:
    from django.core.files.storage import default_storage
    lines.append(f"default_storage class: {default_storage.__class__.__module__}.{default_storage.__class__.__name__}")
except Exception as e:
    lines.append(f"default_storage error: {e!r}")

# avatar field storage
try:
    from accounts.models import CustomUser
    stcls = type(CustomUser._meta.get_field("avatar").storage)
    lines.append(f"CustomUser.avatar storage class: {stcls.__module__}.{stcls.__name__}")
except Exception as e:
    lines.append(f"avatar field storage introspection error: {e!r}")

if setup_err:
    lines.insert(0, setup_err)

# Print to stdout
print("\n".join(lines))

# Also persist to a file so we can read it back from the editor
try:
    import pathlib
    out_dir = pathlib.Path(__file__).parent
    (out_dir / "print_storage.out.txt").write_text("\n".join(lines), encoding="utf-8")
except Exception:
    pass

"""
Lightweight stub for django-cloudinary-storage to keep migrations and code import-safe
when the real package is not installed on the web dyno (Starter-plan friendly).

Many historical migrations import:
    import cloudinary_storage.storage
and use:
    cloudinary_storage.storage.MediaCloudinaryStorage()
    cloudinary_storage.storage.RawMediaCloudinaryStorage()

This stub provides compatible classes that fall back to Django's FileSystemStorage.
It avoids migration import crashes and lets runtime default to the project's
DEFAULT_FILE_STORAGE (e.g., local filesystem via WhiteNoise).

This file is only used if the real 'cloudinary_storage' package is not present.
"""
try:
    from django.core.files.storage import FileSystemStorage
except Exception:
    # Minimal no-op fallback to avoid import errors even before Django loads
    class FileSystemStorage:  # type: ignore
        def __init__(self, *args, **kwargs):
            pass

class MediaCloudinaryStorage(FileSystemStorage):  # type: ignore
    """Fallback to local filesystem storage."""
    pass

class RawMediaCloudinaryStorage(FileSystemStorage):  # type: ignore
    """Fallback to local filesystem storage."""
    pass

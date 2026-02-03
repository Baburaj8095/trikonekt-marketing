"""
Smart shim for django-cloudinary-storage.

Goal:
- If the real third-party package exists in site-packages and CLOUDINARY_URL is set,
  expose its storage classes so Django saves to Cloudinary.
- Otherwise, fall back to Django's FileSystemStorage so migrations/imports don't break.

Why:
- This project vendors a local 'cloudinary_storage' package to keep historical migrations import-safe.
  That local package normally shadows the real site-packages module on sys.path.
  This shim detects the real module and re-exports its classes when available.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Default to local filesystem storage (safe fallback)
try:
    from django.core.files.storage import FileSystemStorage
except Exception:
    # Minimal no-op fallback to avoid import errors even before Django loads
    class FileSystemStorage:  # type: ignore
        def __init__(self, *args, **kwargs):
            pass

# Placeholders (will be overridden by real classes if detected)
class MediaCloudinaryStorage(FileSystemStorage):  # type: ignore
    """Fallback to local filesystem storage."""
    pass


class RawMediaCloudinaryStorage(FileSystemStorage):  # type: ignore
    """Fallback to local filesystem storage."""
    pass


def _try_bind_real_classes():
    """
    Enhanced resolver:
    When CLOUDINARY_URL is set, try to bind to the real django-cloudinary-storage
    implementation even though this vendored shim shadows the module name.

    Strategy:
    1) Use importlib.metadata to locate the installed distribution and resolve the
       path to cloudinary_storage/storage.py inside site-packages.
    2) Fallback to sys.path scanning (excluding this project path) to find a different
       cloudinary_storage/storage.py.
    3) Dynamically import that file under a temporary module name and rebind the
       storage classes in this shim.
    """
    if not os.environ.get("CLOUDINARY_URL"):
        return

    real_storage_path: Path | None = None

    # 1) Prefer distribution metadata (robust across virtualenv and editors)
    try:
        try:
            from importlib import metadata as importlib_metadata  # py3.8+
        except Exception:  # pragma: no cover
            import importlib_metadata  # type: ignore

        dist = None
        for dist_name in ("django-cloudinary-storage", "cloudinary-storage", "django_cloudinary_storage"):
            try:
                dist = importlib_metadata.distribution(dist_name)
                if dist:
                    break
            except Exception:
                continue

        if dist:
            files = list(getattr(dist, "files", []) or [])
            for f in files:
                try:
                    s = str(f).replace("\\", "/")
                    if s.endswith("cloudinary_storage/storage.py"):
                        cand = Path(dist.locate_file(f)).resolve()
                        if cand.exists():
                            real_storage_path = cand
                            break
                except Exception:
                    pass
    except Exception:
        # ignore and fallback to sys.path scan
        real_storage_path = None

    # 2) Fallback: scan sys.path for a different cloudinary_storage/storage.py
    if real_storage_path is None:
        try:
            import importlib.util
            this_file = Path(__file__).resolve()
            this_pkg_dir = this_file.parent  # .../backend/cloudinary_storage

            for p in list(sys.path):
                try:
                    base = Path(p).resolve()
                except Exception:
                    continue

                # Skip this project path (so we don't pick ourselves)
                try:
                    # Python 3.9+: Path.is_relative_to
                    if this_pkg_dir.is_relative_to(base):
                        continue
                except AttributeError:
                    try:
                        this_pkg_dir.relative_to(base)
                        continue
                    except Exception:
                        pass

                candidate = base / "cloudinary_storage" / "storage.py"
                if candidate.exists() and candidate.resolve() != this_file:
                    real_storage_path = candidate.resolve()
                    break
        except Exception:
            real_storage_path = None

    if not real_storage_path:
        # Could not resolve the real implementation; stay on FileSystemStorage fallback
        return

    # 3) Load and rebind classes from the resolved real module path
    try:
        import importlib.util
        mod_name = "_sitepkg_cloudinary_storage_storage"
        spec = importlib.util.spec_from_file_location(mod_name, str(real_storage_path))
        if not spec or not spec.loader:
            return
        real_mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(real_mod)  # type: ignore[attr-defined]

        real_media = getattr(real_mod, "MediaCloudinaryStorage", None)
        real_raw = getattr(real_mod, "RawMediaCloudinaryStorage", None)
        if real_media and real_raw:
            globals()["MediaCloudinaryStorage"] = real_media  # type: ignore[assignment]
            globals()["RawMediaCloudinaryStorage"] = real_raw  # type: ignore[assignment]
    except Exception:
        # If anything fails here, silently retain FileSystemStorage-based fallback
        return


# Attempt to rebind to the real classes at import time
_try_bind_real_classes()

# If still using local FileSystemStorage fallback but CLOUDINARY_URL is configured,
# provide a minimal direct Cloudinary-backed storage so new uploads go to Cloudinary.
try:
    if os.environ.get("CLOUDINARY_URL"):
        from django.core.files.storage import Storage  # type: ignore
        from django.core.files.base import File  # type: ignore
        from cloudinary import uploader  # type: ignore

        def _is_fallback_media_storage(cls) -> bool:
            try:
                # Our fallback classes subclass FileSystemStorage.
                return issubclass(cls, FileSystemStorage)
            except Exception:
                return False

        if _is_fallback_media_storage(MediaCloudinaryStorage):
            class _DirectCloudinaryStorage(Storage):  # type: ignore
                def _save(self, name, content):
                    # Determine folder from provided relative name, default to 'uploads'
                    folder = "uploads"
                    try:
                        p = str(name or "").replace("\\", "/")
                        if p.startswith("/"):
                            p = p.lstrip("/")
                        if p:
                            parts = [seg for seg in p.split("/") if seg]
                            if len(parts) > 1:
                                folder = "/".join(parts[:-1]) or "uploads"
                            elif parts:
                                # If only filename without folder, keep default
                                pass
                    except Exception:
                        pass
                    try:
                        # Ensure pointer at start
                        try:
                            content.seek(0)
                        except Exception:
                            pass
                        res = uploader.upload(
                            content,
                            folder=folder,
                            resource_type="image",
                            invalidate=True,
                        )
                        url = res.get("secure_url") or res.get("url")
                        if not url:
                            raise RuntimeError("Cloudinary upload returned no URL")
                        # Store the absolute URL as the 'name'; url() will return it verbatim.
                        return url
                    finally:
                        # Best-effort: reset/close if needed
                        try:
                            if hasattr(content, "seek"):
                                content.seek(0)
                        except Exception:
                            pass

                def url(self, name):
                    try:
                        s = str(name or "")
                        if s.startswith("http://") or s.startswith("https://"):
                            return s
                        return s
                    except Exception:
                        return str(name or "")

                def exists(self, name):
                    # We treat names (URLs) as unique; allow overwrites by returning False.
                    return False

            # Rebind both storages to our direct Cloudinary storage
            MediaCloudinaryStorage = _DirectCloudinaryStorage  # type: ignore[assignment]
            RawMediaCloudinaryStorage = _DirectCloudinaryStorage  # type: ignore[assignment]
except Exception:
    # Do not break startup due to optional Cloudinary wrapper
    pass

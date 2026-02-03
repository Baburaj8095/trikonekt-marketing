import os
from typing import Iterable, Optional

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandParser
from django.db.models import Q
from django.conf import settings

from accounts.models import CustomUser


def is_local_media_url(url: Optional[str]) -> bool:
    if not url:
        return False
    u = str(url).lower()
    return (
        u.startswith("http://localhost")
        or u.startswith("http://127.0.0.1")
        or u.startswith("http://0.0.0.0")
        or "/media/" in u  # best-effort
    )


class Command(BaseCommand):
    help = "Re-upload existing user avatars stored on local /media to Cloudinary and update URLs."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--dry-run", action="store_true", help="Only print what would be migrated, do not upload.")
        parser.add_argument("--limit", type=int, default=None, help="Limit number of users to process.")
        parser.add_argument("--user-id", type=int, default=None, help="Migrate only this user id.")
        parser.add_argument("--delete-local", action="store_true", help="Delete local file after successful upload.")
        parser.add_argument("--verbose", action="store_true", help="Verbose output.")

    def iter_candidates(self, user_id: Optional[int] = None, limit: Optional[int] = None) -> Iterable[CustomUser]:
        qs = CustomUser.objects.all().order_by("id")
        if user_id:
            qs = qs.filter(id=user_id)
        # Avatar must be set
        qs = qs.exclude(avatar="")
        qs = qs.exclude(avatar__isnull=True)

        # We can't reliably filter by URL at DB level; fetch and filter in Python
        if limit is not None and limit > 0:
            qs = qs[:limit]
        return qs

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        limit = options.get("limit")
        uid = options.get("user_id")
        delete_local = bool(options.get("delete_local"))
        verbose = bool(options.get("verbose"))

        media_root = getattr(settings, "MEDIA_ROOT", None)
        if not media_root:
            self.stderr.write(self.style.ERROR("MEDIA_ROOT is not configured; cannot resolve local files."))
            return

        count_total = 0
        count_skipped = 0
        count_uploaded = 0
        count_missing = 0
        count_failed = 0

        for user in self.iter_candidates(user_id=uid, limit=limit):
            count_total += 1
            f = getattr(user, "avatar", None)
            url = getattr(f, "url", "") if f else ""
            name = getattr(f, "name", "") if f else ""
            if not f or not name:
                if verbose:
                    self.stdout.write(f"[skip] user#{user.id} has no avatar set")
                count_skipped += 1
                continue

            if url and not is_local_media_url(url):
                if verbose:
                    self.stdout.write(f"[skip] user#{user.id} avatar already appears remote: {url}")
                count_skipped += 1
                continue

            # Resolve local disk path
            rel_path = name.replace("\\", "/").lstrip("/").lstrip("media/").lstrip("/")
            disk_path = os.path.join(media_root, rel_path)
            if not os.path.exists(disk_path):
                self.stderr.write(self.style.WARNING(f"[missing] user#{user.id} file not found on disk: {disk_path}"))
                count_missing += 1
                continue

            if dry:
                self.stdout.write(f"[dry-run] would upload user#{user.id}: {disk_path} -> cloud storage")
                continue

            try:
                with open(disk_path, "rb") as fp:
                    data = fp.read()

                base_name = os.path.basename(rel_path) or "avatar.jpg"
                # Re-save via model field; this uses DEFAULT_FILE_STORAGE (Cloudinary) now
                user.avatar.save(base_name, ContentFile(data), save=True)
                count_uploaded += 1
                self.stdout.write(self.style.SUCCESS(f"[ok] user#{user.id} uploaded -> {getattr(user.avatar, 'url', '')}"))

                if delete_local:
                    try:
                        os.remove(disk_path)
                        if verbose:
                            self.stdout.write(f"[cleanup] deleted local file {disk_path}")
                    except Exception as de:
                        self.stderr.write(self.style.WARNING(f"[warn] could not delete local file {disk_path}: {de}"))

            except Exception as e:
                count_failed += 1
                self.stderr.write(self.style.ERROR(f"[error] user#{user.id} upload failed: {e}"))

        if dry:
            self.stdout.write(self.style.NOTICE("Dry-run finished."))

        self.stdout.write(
            f"Total: {count_total}, uploaded: {count_uploaded}, skipped: {count_skipped}, missing: {count_missing}, failed: {count_failed}"
        )

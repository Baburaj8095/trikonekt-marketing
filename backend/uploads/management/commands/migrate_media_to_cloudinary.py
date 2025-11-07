from django.core.management.base import BaseCommand
from django.core.files.base import File
from django.core.files.storage import default_storage
from django.conf import settings

from uploads.models import HomeCard, DashboardCard, FileUpload, LuckyDrawSubmission, JobApplication
from market.models import Product, Banner
from coupons.models import CouponSubmission

import os


def is_cloudinary_url(url: str) -> bool:
    try:
        if not url:
            return False
        url = str(url)
        return url.startswith("http") and ("res.cloudinary.com" in url or "cloudinary" in url)
    except Exception:
        return False


def open_existing_file(name: str):
    """
    Try to open the file from the current storage by its name.
    If that fails, attempt filesystem path from MEDIA_ROOT + name.
    Returns a file-like object or raises.
    """
    # 1) Try storage by name (works if file exists in current storage backend)
    try:
        return default_storage.open(name, mode="rb")
    except Exception:
        pass

    # 2) Try filesystem path
    try:
        fs_path = name
        if not os.path.isabs(fs_path):
            fs_path = os.path.join(getattr(settings, "MEDIA_ROOT", ""), name)
        return open(fs_path, "rb")
    except Exception as e:
        raise e


def reupload_field_to_cloudinary(instance, field_name: str, dry_run: bool = False):
    """
    For a model instance and a File/ImageField name, if the file URL is not Cloudinary,
    attempt to open the existing file and re-save it so that the current DEFAULT_FILE_STORAGE
    (Cloudinary) takes over.
    Returns a tuple (status, message).
    Status values:
      - already_cloudinary
      - missing
      - not_found
      - would_upload
      - uploaded
      - error
    """
    f = getattr(instance, field_name, None)
    if not f:
        return ("missing", f"{instance.__class__.__name__}#{instance.pk} has no field '{field_name}'")

    # Determine current URL/name
    url = ""
    try:
        url = getattr(f, "url", "")
    except Exception:
        url = ""

    if is_cloudinary_url(url):
        return ("already_cloudinary", f"{instance.__class__.__name__}#{instance.pk} {field_name} already on Cloudinary: {url}")

    name = getattr(f, "name", None)
    if not name:
        return ("missing", f"{instance.__class__.__name__}#{instance.pk} {field_name} has no file name set")

    # Try to open bytes
    try:
        fh = open_existing_file(name)
    except Exception as e:
        return ("not_found", f"{instance.__class__.__name__}#{instance.pk} {field_name} source not found: {name} ({e})")

    if dry_run:
        try:
            fh.close()
        except Exception:
            pass
        return ("would_upload", f"{instance.__class__.__name__}#{instance.pk} would upload {name} to Cloudinary")

    # Perform upload via field.save using current DEFAULT_FILE_STORAGE
    try:
        # Keep the same relative name; Cloudinary storage will handle public_id
        base_name = name  # preserve folder grouping
        f.save(base_name, File(fh), save=True)
        # Ensure instance persisted
        instance.save(update_fields=[field_name])
        try:
            fh.close()
        except Exception:
            pass
        # Re-fetch url to confirm
        new_url = ""
        try:
            new_url = getattr(getattr(instance, field_name), "url", "")
        except Exception:
            new_url = ""
        return ("uploaded", f"{instance.__class__.__name__}#{instance.pk} {field_name} uploaded. New URL: {new_url}")
    except Exception as e:
        try:
            fh.close()
        except Exception:
            pass
        return ("error", f"{instance.__class__.__name__}#{instance.pk} {field_name} upload failed: {e}")


class Command(BaseCommand):
    help = "Re-upload legacy media files to Cloudinary when CLOUDINARY_URL is enabled. Supports dry-run."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not modify anything, only report what would be done.",
        )
        parser.add_argument(
            "--only",
            choices=[
                "all",
                "homecard",
                "dashboardcard",
                "fileupload",
                "luckydrawsubmission",
                "jobapplication",
                "product",
                "banner",
                "couponsubmission",
            ],
            default="all",
            help="Which model to process. Use 'all' to process everything.",
        )
        parser.add_argument(
            "--ids",
            type=str,
            default="",
            help="Comma-separated list of IDs to limit processing (applies to the chosen model).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Process at most N records for each selected model (0 means no limit).",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Verbose output per record.",
        )

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        only = options.get("only") or "all"
        ids_str = (options.get("ids") or "").strip()
        limit = int(options.get("limit") or 0)
        verbose = bool(options.get("verbose"))

        storage_cls = getattr(settings, "DEFAULT_FILE_STORAGE", "")
        cloudinary_env = bool(os.environ.get("CLOUDINARY_URL"))
        using_cloudinary = "cloudinary" in (storage_cls or "")

        self.stdout.write(self.style.NOTICE(f"DEFAULT_FILE_STORAGE: {storage_cls}"))
        self.stdout.write(self.style.NOTICE(f"CLOUDINARY_URL set: {cloudinary_env}"))
        self.stdout.write(self.style.NOTICE(f"Using Cloudinary storage: {using_cloudinary}"))
        if not using_cloudinary:
            self.stdout.write(self.style.WARNING("WARNING: Cloudinary storage is not active. Aborting."))
            return

        ids = set()
        if ids_str:
            try:
                ids = {int(x.strip()) for x in ids_str.split(",") if x.strip()}
            except Exception:
                self.stdout.write(self.style.WARNING("Invalid --ids; ignoring."))
                ids = set()

        # Define targets (label, model, field)
        all_targets = [
            ("homecard", HomeCard, "image"),
            ("dashboardcard", DashboardCard, "image"),
            ("fileupload", FileUpload, "file"),
            ("luckydrawsubmission", LuckyDrawSubmission, "image"),
            ("jobapplication", JobApplication, "resume"),
            ("product", Product, "image"),
            ("banner", Banner, "image"),
            ("couponsubmission", CouponSubmission, "file"),
        ]

        # Filter targets based on --only
        if only != "all":
            targets = [t for t in all_targets if t[0] == only]
        else:
            targets = list(all_targets)

        # Summary counters
        totals = {}
        for label, _, _ in targets:
            totals[label] = {
                "processed": 0,
                "uploaded": 0,
                "would_upload": 0,
                "skipped": 0,  # already_cloudinary
                "missing": 0,
                "not_found": 0,
                "error": 0,
            }

        def qs_for_model(model):
            q = model.objects.all().order_by("id")
            if ids:
                q = q.filter(id__in=ids)
            if limit and limit > 0:
                q = q[:limit]
            return q

        for label, model, field_name in targets:
            qset = qs_for_model(model)
            for obj in qset:
                totals[label]["processed"] += 1
                status, msg = reupload_field_to_cloudinary(obj, field_name, dry_run=dry_run)
                if verbose:
                    if status in ("uploaded", "would_upload"):
                        self.stdout.write(self.style.SUCCESS(msg))
                    elif status in ("already_cloudinary",):
                        self.stdout.write(self.style.HTTP_INFO(msg))
                    elif status in ("missing", "not_found"):
                        self.stdout.write(self.style.WARNING(msg))
                    else:
                        self.stdout.write(self.style.ERROR(msg))
                # tally
                if status == "uploaded":
                    totals[label]["uploaded"] += 1
                elif status == "would_upload":
                    totals[label]["would_upload"] += 1
                elif status in ("already_cloudinary",):
                    totals[label]["skipped"] += 1
                elif status == "missing":
                    totals[label]["missing"] += 1
                elif status == "not_found":
                    totals[label]["not_found"] += 1
                else:
                    totals[label]["error"] += 1

        # Summary
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("Summary:"))
        for label, stats in totals.items():
            self.stdout.write(
                f"- {label}: "
                f"processed={stats['processed']} "
                f"uploaded={stats['uploaded']} "
                f"would_upload={stats['would_upload']} "
                f"skipped(already_cloudinary)={stats['skipped']} "
                f"missing={stats['missing']} "
                f"not_found={stats['not_found']} "
                f"errors={stats['error']}"
            )
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry-run mode: no files were uploaded."))

from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
from typing import Iterable, List, Optional

from business.models import (
    PromoPackage,
    PromoPurchase,
    PromoPackageEBook,
    EBookAccess,
)
from accounts.models import CustomUser


def _is_prime150(pkg: PromoPackage) -> bool:
    try:
        if str(getattr(pkg, "type", "")) != "PRIME":
            return False
        price = Decimal(str(getattr(pkg, "price", "0") or "0"))
        if abs(price - Decimal("150")) <= Decimal("0.5"):
            return True
        code = (getattr(pkg, "code", "") or "").lower()
        name = (getattr(pkg, "name", "") or "").lower()
        return "150" in code or "150" in name
    except Exception:
        return False


class Command(BaseCommand):
    help = (
        "Backfill/grant e‑book access for users who have APPROVED PRIME ₹150 promo purchases. "
        "Requires mapping rows (PromoPackageEBook) to determine which e‑books to grant.\n\n"
        "Usage examples:\n"
        "  python manage.py backfill_prime150_ebooks             # all users\n"
        "  python manage.py backfill_prime150_ebooks --user TR9886178729\n"
        "  python manage.py backfill_prime150_ebooks --user 123   # by user id\n"
        "  python manage.py backfill_prime150_ebooks --dry-run"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--user",
            dest="users",
            action="append",
            default=[],
            help="Limit to a specific user by username/prefixed_id or numeric id. Can be repeated.",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write changes; just print what would be granted.",
        )

    def _resolve_users(self, values: Iterable[str]) -> List[CustomUser]:
        out: List[CustomUser] = []
        seen_ids = set()
        for val in values or []:
            v = (val or "").strip()
            if not v:
                continue
            u: Optional[CustomUser] = None
            # Try by id
            try:
                if v.isdigit():
                    u = CustomUser.objects.filter(pk=int(v)).first()
            except Exception:
                u = None
            # Try by username or prefixed_id
            if u is None:
                u = (
                    CustomUser.objects.filter(username=v).first()
                    or CustomUser.objects.filter(prefixed_id=v).first()
                )
            if u and u.id not in seen_ids:
                out.append(u)
                seen_ids.add(u.id)
        return out

    def handle(self, *args, **opts):
        dry = bool(opts.get("dry_run"))
        users_in: List[str] = list(opts.get("users") or [])
        users: Optional[List[CustomUser]] = None
        if users_in:
            users = self._resolve_users(users_in)
            if not users:
                self.stdout.write(self.style.WARNING("No matching users for --user arguments."))
                return

        # Identify PRIME150 packages
        pkgs = [p for p in PromoPackage.objects.filter(is_active=True) if _is_prime150(p)]
        if not pkgs:
            self.stdout.write(self.style.WARNING("No PRIME ₹150 packages found."))
            return

        pkg_ids = [p.id for p in pkgs]
        maps = list(PromoPackageEBook.objects.filter(package_id__in=pkg_ids, is_active=True).select_related("ebook", "package"))
        # Fallback set of latest active e‑books if no package mapping exists
        fallback_ebooks = []
        if not maps:
            from business.models import PromoEBook  # local import to avoid circular in migrations
            fallback_ebooks = list(PromoEBook.objects.filter(is_active=True).order_by("-created_at")[:1])
            if not fallback_ebooks:
                self.stdout.write(self.style.WARNING("No PromoPackageEBook mappings or active e‑books found for fallback. Nothing to grant."))
                return

        # Build mapping index
        by_pkg = {}
        for m in maps:
            by_pkg.setdefault(m.package_id, []).append(m)

        qs = PromoPurchase.objects.select_related("user", "package").filter(status="APPROVED", package_id__in=pkg_ids)
        if users is not None:
            qs = qs.filter(user__in=users)

        total_purchases = qs.count()
        created_links = 0
        skipped_existing = 0

        self.stdout.write(f"Scanning {total_purchases} approved purchase(s) across {len(pkgs)} package(s). Dry‑run={dry}")

        with (transaction.atomic() if not dry else transaction.atomic()):
            for pp in qs.iterator():
                uid = getattr(pp.user, "id", None)
                uname = getattr(pp.user, "username", None)
                pkg_id = getattr(pp.package, "id", None)
                pkg_code = getattr(pp.package, "code", None)
                mappings = by_pkg.get(pkg_id, [])
                if not mappings:
                    # Use fallback e‑books when package has no explicit mappings
                    for eb in fallback_ebooks:
                        exists = EBookAccess.objects.filter(user_id=uid, ebook_id=getattr(eb, "id", None)).exists()
                        if exists:
                            skipped_existing += 1
                            continue
                        if dry:
                            self.stdout.write(f"[DRY] Would grant: user={uname} ebook='{getattr(eb, 'title', 'E‑Book')}' (pkg={pkg_code}) [fallback]")
                            created_links += 1
                        else:
                            if getattr(eb, "id", None) is not None:
                                EBookAccess.objects.get_or_create(user_id=uid, ebook_id=eb.id)
                                created_links += 1
                    continue

                for m in mappings:
                    exists = EBookAccess.objects.filter(user_id=uid, ebook_id=m.ebook_id).exists()
                    if exists:
                        skipped_existing += 1
                        continue
                    if dry:
                        self.stdout.write(f"[DRY] Would grant: user={uname} ebook='{getattr(m.ebook, 'title', 'E‑Book')}' (pkg={pkg_code})")
                        created_links += 1
                    else:
                        EBookAccess.objects.get_or_create(user_id=uid, ebook_id=m.ebook_id)
                        created_links += 1

            if dry:
                # Roll back in dry run (automatic after leaving the atomic block without commit)
                pass

        self.stdout.write(self.style.SUCCESS(f"Done. Granted={created_links}, Already had access={skipped_existing}, Purchases scanned={total_purchases}."))

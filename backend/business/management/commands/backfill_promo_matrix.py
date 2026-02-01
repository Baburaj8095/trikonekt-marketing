from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable, Optional, Set, Tuple, List

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from business.models import PromoPurchase, AutoPoolAccount, is_matrix_eligible


@dataclass
class UserStatus:
    user_id: int
    username: str
    has_five: bool
    has_three: bool
    made_changes: bool = False
    note: str = ""


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


class Command(BaseCommand):
    help = "Backfill matrix accounts (FIVE_150 and THREE_150) for all APPROVED PRIME 150/750 promo purchases where missing. "\
           "This creates ONLY matrix accounts (no wallet payouts), and stamps visibility flags on the user."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--dry-run",
            action="store_true",
            dest="dry_run",
            help="Perform a dry run without modifying the database.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            dest="apply",
            help="Actually apply changes (default if neither --dry-run nor --apply specified).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            dest="limit",
            default=0,
            help="Limit number of users to process (0 means no limit).",
        )
        parser.add_argument(
            "--verbose-users",
            action="store_true",
            dest="verbose_users",
            help="Print per-user actions.",
        )

    def handle(self, *args, **options):
        dry_run: bool = bool(options.get("dry_run"))
        apply_flag: bool = bool(options.get("apply"))
        limit: int = int(options.get("limit") or 0)
        verbose_users: bool = bool(options.get("verbose_users"))

        # default mode: apply unless explicitly dry-run
        do_apply = not dry_run or apply_flag
        if dry_run and apply_flag:
            self.stdout.write(self.style.WARNING("Both --dry-run and --apply provided; proceeding with --apply (mutating)."))
            do_apply = True
        if dry_run and not apply_flag:
            do_apply = False

        # Find all users with APPROVED PRIME purchases price≈150 or ≈750
        from decimal import Decimal as D
        approved_qs = PromoPurchase.objects.select_related("user", "package").filter(
            status="APPROVED",
            package__type="PRIME",
        ).filter(
            Q(package__price__gte=D("149.5"), package__price__lte=D("150.5"))
            | Q(package__price__gte=D("749.5"), package__price__lte=D("750.5"))
        ).order_by("user_id").only("id", "user_id", "package_id")

        # De-duplicate by user; we only need to ensure each user has 5/3 once
        seen_users: Set[int] = set()
        targets: List[Tuple[int, int]] = []  # [(user_id, any_purchase_id)]
        for p in approved_qs:
            uid = int(getattr(p, "user_id", 0) or 0)
            if uid and uid not in seen_users:
                seen_users.add(uid)
                targets.append((uid, int(getattr(p, "id", 0) or 0)))
            if limit > 0 and len(targets) >= limit:
                break

        if not targets:
            self.stdout.write(self.style.SUCCESS("No APPROVED PRIME 150/750 purchases found to backfill."))
            return

        self.stdout.write(f"Found {len(targets)} user(s) with approved PRIME 150/750 purchases to inspect.")

        total = len(targets)
        made_any = 0
        skipped = 0
        fixed_both = 0
        fixed_one = 0

        for idx, (user_id, purchase_id) in enumerate(targets, start=1):
            # Best-effort fetch of user with minimal fields to avoid heavy loads
            from accounts.models import CustomUser
            u = CustomUser.objects.filter(pk=user_id).only("id", "username", "category", "is_staff", "is_superuser",
                                                           "first_purchase_activated_at", "account_active").first()
            if not u:
                skipped += 1
                if verbose_users:
                    self.stdout.write(self.style.WARNING(f"[{idx}/{total}] user_id={user_id} not found; skip"))
                continue

            # Eligibility gate
            if not is_matrix_eligible(u):
                skipped += 1
                if verbose_users:
                    self.stdout.write(self.style.WARNING(f"[{idx}/{total}] {u.username} (#{u.id}) not eligible for matrix; skip"))
                continue

            # Check if user already has FIVE_150 and THREE_150 accounts
            try:
                has_five = AutoPoolAccount.objects.filter(owner_id=u.id, pool_type="FIVE_150", status="ACTIVE").exists()
            except Exception:
                has_five = False
            try:
                has_three = AutoPoolAccount.objects.filter(owner_id=u.id, pool_type="THREE_150", status="ACTIVE").exists()
            except Exception:
                has_three = False

            need_five = not has_five
            need_three = not has_three

            if not need_five and not need_three:
                skipped += 1
                if verbose_users:
                    self.stdout.write(f"[{idx}/{total}] {u.username} (#{u.id}) already has FIVE_150 and THREE_150; skip")
                # Ensure visibility flags (best-effort)
                if do_apply:
                    dirty = False
                    if not getattr(u, "account_active", False):
                        u.account_active = True
                        dirty = True
                    if getattr(u, "first_purchase_activated_at", None) is None:
                        u.first_purchase_activated_at = timezone.now()
                        dirty = True
                    if dirty:
                        try:
                            u.save(update_fields=["account_active", "first_purchase_activated_at"])
                        except Exception:
                            pass
                continue

            # Create missing accounts (forced-matrix placement). No payouts here.
            made_now = False
            if do_apply:
                with transaction.atomic():
                    # Re-check within transaction to minimize races
                    try:
                        has_five = AutoPoolAccount.objects.select_for_update().filter(owner_id=u.id, pool_type="FIVE_150", status="ACTIVE").exists()
                    except Exception:
                        has_five = False
                    try:
                        has_three = AutoPoolAccount.objects.select_for_update().filter(owner_id=u.id, pool_type="THREE_150", status="ACTIVE").exists()
                    except Exception:
                        has_three = False

                    if not has_five:
                        try:
                            AutoPoolAccount.place_in_five_pool(
                                u,
                                pool_type="FIVE_150",
                                amount=_q2(150),  # entry amount metadata only
                                source_type="BACKFILL",
                                source_id=f"PP:{purchase_id}",
                            )
                            made_now = True
                        except Exception:
                            # keep going to try creating three
                            pass
                    if not has_three:
                        try:
                            AutoPoolAccount.place_in_three_pool(
                                u,
                                pool_type="THREE_150",
                                amount=_q2(150),
                                source_type="BACKFILL",
                                source_id=f"PP:{purchase_id}",
                            )
                            made_now = True
                        except Exception:
                            pass

                    # Ensure visibility flags without triggering reward/franchise side effects
                    try:
                        dirty = False
                        if not getattr(u, "account_active", False):
                            u.account_active = True
                            dirty = True
                        if getattr(u, "first_purchase_activated_at", None) is None:
                            u.first_purchase_activated_at = timezone.now()
                            dirty = True
                        if dirty:
                            u.save(update_fields=["account_active", "first_purchase_activated_at"])
                    except Exception:
                        pass
            else:
                made_now = (need_five or need_three)

            if made_now:
                made_any += 1
                if need_five and need_three:
                    fixed_both += 1
                else:
                    fixed_one += 1
                if verbose_users:
                    what = []
                    if need_five:
                        what.append("FIVE_150")
                    if need_three:
                        what.append("THREE_150")
                    self.stdout.write(self.style.SUCCESS(f"[{idx}/{total}] {u.username} (#{u.id}) backfilled: {', '.join(what)}"))
            else:
                skipped += 1
                if verbose_users:
                    self.stdout.write(self.style.WARNING(f"[{idx}/{total}] {u.username} (#{u.id}) no change"))

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Backfill Summary"))
        self.stdout.write(f"  Users scanned       : {total}")
        self.stdout.write(f"  Users changed       : {made_any}")
        self.stdout.write(f"    - fixed both pools: {fixed_both}")
        self.stdout.write(f"    - fixed one pool  : {fixed_one}")
        self.stdout.write(f"  Users skipped       : {skipped}")
        self.stdout.write(f"  Mode                : {'APPLY (mutating)' if do_apply else 'DRY-RUN (no changes)'}")
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Done."))

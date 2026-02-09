from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction, models

from accounts.models import CustomUser
from business.models import AutoPoolAccount


class Command(BaseCommand):
    help = (
        "Cleanup 5-matrix (FIVE_150) entries that were created at registration time (source_type='REGISTRATION'), "
        "and reset genealogy fields on users who have not activated PRIME yet.\n"
        "Default is a DRY-RUN (no changes). Use --apply to persist changes.\n"
        "Optionally attempt hard-delete of registration entries that have no children with --hard-delete.\n"
        "You can also pass --enforce-sentinel to run the single-sentinel enforcement after updates."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes to the database (default is dry-run).",
        )
        parser.add_argument(
            "--hard-delete",
            action="store_true",
            help="Attempt to DELETE REGISTRATION entries with no children (else mark CLOSED).",
        )
        parser.add_argument(
            "--enforce-sentinel",
            action="store_true",
            help="Enforce single sentinel after updates (uses business.services.structure.enforce_single_sentinel).",
        )

    def _count_children_map(self, ids: list[int]) -> dict[int, int]:
        if not ids:
            return {}
        rows = (
            AutoPoolAccount.objects.filter(parent_account_id__in=ids, pool_type="FIVE_150")
            .values("parent_account_id")
            .annotate(c=models.Count("id"))
        )
        return {int(r["parent_account_id"]): int(r["c"]) for r in rows}

    def handle(self, *args: Any, **options: Any):
        do_apply: bool = bool(options.get("apply"))
        hard_delete: bool = bool(options.get("hard_delete"))
        do_enforce: bool = bool(options.get("enforce_sentinel"))

        # 1) Identify FIVE_150 active entries created during registration.
        reg_qs = AutoPoolAccount.objects.filter(
            pool_type="FIVE_150", status="ACTIVE", source_type="REGISTRATION"
        ).order_by("id")

        reg_ids = list(reg_qs.values_list("id", flat=True))
        owners = list(reg_qs.values_list("owner_id", flat=True))

        # 2) Count children per REGISTRATION entry (all statuses) to safely hard-delete leafs only.
        child_map = self._count_children_map(reg_ids)

        # 3) Identify users with genealogy set but not yet activated.
        user_qs = CustomUser.objects.filter(
            first_purchase_activated_at__isnull=True
        ).filter(
            models.Q(parent__isnull=False) | models.Q(matrix_position__isnull=False) | models.Q(depth__gt=0)
        ).order_by("id")
        user_ids = list(user_qs.values_list("id", flat=True))

        self.stdout.write(self.style.NOTICE("=== 5-Matrix Registration Cleanup (DRY RUN)" if not do_apply else "=== 5-Matrix Registration Cleanup (APPLY)"))
        self.stdout.write(f"- FIVE_150 entries with source_type='REGISTRATION' and status='ACTIVE': {len(reg_ids)}")
        if reg_ids:
            leaf_count = sum(1 for i in reg_ids if int(child_map.get(int(i), 0)) == 0)
            non_leaf_count = len(reg_ids) - leaf_count
            self.stdout.write(f"  • Leafs (no children): {leaf_count}")
            self.stdout.write(f"  • Non-leafs (has children): {non_leaf_count}")
        self.stdout.write(f"- Users with genealogy set but not activated (to reset): {len(user_ids)}")
        if not do_apply:
            self.stdout.write(self.style.WARNING("Dry-run only. Use --apply to persist changes."))
            return

        # 4) Apply updates atomically
        with transaction.atomic():
            closed = 0
            deleted = 0

            if hard_delete:
                # Delete leaf REGISTRATION entries only; mark the rest CLOSED
                leaf_ids = [i for i in reg_ids if int(child_map.get(int(i), 0)) == 0]
                non_leaf_ids = [i for i in reg_ids if int(child_map.get(int(i), 0)) != 0]

                if leaf_ids:
                    del_qs = AutoPoolAccount.objects.filter(id__in=leaf_ids, pool_type="FIVE_150", source_type="REGISTRATION")
                    deleted = del_qs.delete()[0]

                if non_leaf_ids:
                    upd_qs = AutoPoolAccount.objects.filter(id__in=non_leaf_ids, pool_type="FIVE_150", source_type="REGISTRATION", status="ACTIVE")
                    closed = upd_qs.update(status="CLOSED")
            else:
                # Safe path: mark all REGISTRATION entries CLOSED
                upd_qs = AutoPoolAccount.objects.filter(id__in=reg_ids, pool_type="FIVE_150", source_type="REGISTRATION", status="ACTIVE")
                closed = upd_qs.update(status="CLOSED")

            # 5) Reset genealogy fields for non-activated users (parent, position, depth)
            reset_count = 0
            if user_ids:
                reset_count = (
                    CustomUser.objects.filter(id__in=user_ids)
                    .update(parent=None, matrix_position=None, depth=0)
                )

        self.stdout.write(self.style.SUCCESS(f"Done. CLOSED={closed}, DELETED={deleted}, USERS_RESET={reset_count}"))

        # 6) Optionally enforce a single sentinel and reattach extras
        if do_enforce:
            try:
                from business.services.structure import enforce_single_sentinel
                sentinel = enforce_single_sentinel("FIVE_150")
                self.stdout.write(self.style.SUCCESS(f"Sentinel enforced: id={getattr(sentinel, 'id', None)}"))
            except Exception as e:
                raise CommandError(f"Failed to enforce sentinel: {e}")

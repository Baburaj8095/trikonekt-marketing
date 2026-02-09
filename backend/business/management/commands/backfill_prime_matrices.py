from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional, Dict, Any, Iterable, List, Tuple

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q, Min

from accounts.models import CustomUser
from business.models import AutoPoolAccount, CommissionConfig, SubscriptionActivation, is_matrix_eligible
from business.services.placement import NoCapacityError, MaxDepthError
import time


class Command(BaseCommand):
    help = (
        "Backfill matrix accounts for all PRIME-activated consumers in activation timestamp order.\n"
        "- FIVE_150: sponsor-anchored forced matrix (place under sponsor subtree when sponsor has FIVE_150; otherwise sentinel fallback).\n"
        "- THREE_150: global auto-pool (ignore sponsor; start at sentinel root).\n"
        "- Does NOT reseat existing accounts; creates only missing entries.\n"
        "- Ordering source priority per user:\n"
        "   first_purchase_activated_at -> earliest SubscriptionActivation(PRIME_150_ACTIVE).created_at -> earliest existing AutoPoolAccount.created_at -> date_joined.\n"
        "Use --dry-run to preview counts without writes.\n"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Run without creating accounts; prints summary only.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Optional cap on number of users to process (0 = no limit)",
        )
        parser.add_argument(
            "--start-after-user-id",
            type=int,
            default=0,
            help="Skip users with id <= this value (for chunked reruns).",
        )
        parser.add_argument(
            "--pools",
            type=str,
            default="FIVE_150,THREE_150",
            help="Comma-separated pools to backfill: FIVE_150,THREE_150",
        )
        parser.add_argument(
            "--all-consumers",
            action="store_true",
            help="Include all consumers (matrix-eligible) ordered by activation_ts (fallback date_joined), ignoring activation markers. Root sentinel owner is excluded.",
        )

    # Retry helpers to reduce transient placement failures without reseating existing data
    def _try_place_three(self, user: CustomUser, base_amount: Decimal, uid: int, ts) -> bool:
        for attempt in range(3):
            try:
                AutoPoolAccount.place_in_three_pool(
                    user,
                    "THREE_150",
                    base_amount,
                    source_type="BACKFILL",
                    source_id=f"user:{uid}|ts:{ts.isoformat()}",
                )
                return True
            except (NoCapacityError, MaxDepthError):
                time.sleep(0.05 * (attempt + 1))
                continue
            except Exception:
                time.sleep(0.05 * (attempt + 1))
                continue
        return False

    def _try_place_five(self, user: CustomUser, base_amount: Decimal, uid: int, ts) -> bool:
        for attempt in range(3):
            try:
                AutoPoolAccount.place_in_five_pool(
                    user,
                    "FIVE_150",
                    base_amount,
                    source_type="BACKFILL",
                    source_id=f"user:{uid}|ts:{ts.isoformat()}",
                )
                return True
            except (NoCapacityError, MaxDepthError):
                time.sleep(0.05 * (attempt + 1))
                continue
            except Exception:
                time.sleep(0.05 * (attempt + 1))
                continue
        return False

    def _q2(self, x) -> Decimal:
        try:
            return Decimal(str(x)).quantize(Decimal("0.01"))
        except Exception:
            return Decimal("0.00")

    def _resolve_activation_ts(self, user: CustomUser) -> datetime:
        """
        Compute deterministic activation timestamp for ordering:
          1) user.first_purchase_activated_at
          2) earliest SubscriptionActivation(PRIME_150_ACTIVE).created_at
          3) earliest AutoPoolAccount.created_at for the user (any pool)
          4) user.date_joined
        """
        # 1) First purchase activation (preferred)
        ts = getattr(user, "first_purchase_activated_at", None)
        if ts:
            return ts

        # 2) Earliest PRIME_150_ACTIVE subscription (if any)
        try:
            row = (
                SubscriptionActivation.objects.filter(
                    user=user,
                    package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME"),
                )
                .order_by("created_at")
                .values_list("created_at", flat=True)
                .first()
            )
            if row:
                return row
        except Exception:
            pass

        # 3) Earliest AutoPoolAccount (any pool)
        try:
            row2 = (
                AutoPoolAccount.objects.filter(owner=user, status="ACTIVE")
                .order_by("created_at")
                .values_list("created_at", flat=True)
                .first()
            )
            if row2:
                return row2
        except Exception:
            pass

        # 4) Fallback to date_joined
        return getattr(user, "date_joined", None) or datetime.utcnow()

    def _eligible_users_queryset(self, all_consumers: bool = False):
        """
        Return consumers to (back)fill matrices.
        If all_consumers is True:
          - include all matrix-eligible consumers (non-staff/superuser, non-agency/employee)
          - exclude the configured Root Consumer (sentinel owner), fallback exclude id=32
        Else:
          - original behavior based on activation markers or existing matrices.
        """
        base = CustomUser.objects.filter(category="consumer")
        # Exclude sentinel/root consumer from placement (should only own sentinel)
        root_ids = []
        try:
            from business.models import RootConsumerConfig
            rc = RootConsumerConfig.get_solo()
            ru = rc.get_root_user()
            if ru and getattr(ru, "id", None):
                root_ids.append(int(ru.id))
        except Exception:
            pass
        # Fallback known id=32 when not configured
        if 32 not in root_ids:
            root_ids.append(32)

        if all_consumers:
            # Broad include: matrix-eligible consumers (approximation in DB filter)
            qs = base.filter(is_staff=False, is_superuser=False).exclude(id__in=root_ids)
            return qs

        has_sub = SubscriptionActivation.objects.filter(
            user_id__in=CustomUser.objects.filter(category="consumer").values_list("id", flat=True),
            package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME"),
        ).values_list("user_id", flat=True)

        has_mx = AutoPoolAccount.objects.filter(
            owner_id__in=CustomUser.objects.filter(category="consumer").values_list("id", flat=True),
            status="ACTIVE",
        ).values_list("owner_id", flat=True)

        qs = base.filter(
            Q(first_purchase_activated_at__isnull=False) | Q(id__in=has_sub) | Q(id__in=has_mx)
        ).exclude(id__in=root_ids).distinct()
        return qs

    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        limit = int(options.get("limit") or 0)
        start_after_user_id = int(options.get("start_after_user_id") or 0)
        pools_in = str(options.get("pools") or "FIVE_150,THREE_150").upper().replace(" ", "")
        pools = [p for p in pools_in.split(",") if p in ("FIVE_150", "THREE_150")]
        all_consumers = bool(options.get("all_consumers", False))
        if not pools:
            self.stdout.write(self.style.ERROR("No valid pools selected. Choose from FIVE_150,THREE_150"))
            return

        cfg = CommissionConfig.get_solo()
        base150 = self._q2(cfg.prime_activation_amount or 150)

        # Ensure sentinel roots exist (readiness for BFS). THREE_150 uses sentinel; FIVE_150 may anchor to sponsor.
        try:
            from business.services.placement import _ensure_sentinel_root
            for p in pools:
                _ensure_sentinel_root(p)
        except Exception:
            pass

        # Gather and sort eligible users by activation_ts asc
        qs = self._eligible_users_queryset(all_consumers=all_consumers)
        if start_after_user_id > 0:
            qs = qs.filter(id__gt=start_after_user_id)

        # Pull minimal fields and compute activation_ts in Python for determinism
        users = list(qs.only("id", "username", "date_joined", "first_purchase_activated_at").order_by("id"))
        ordered: List[Tuple[datetime, int, CustomUser]] = []
        for u in users:
            ts = self._resolve_activation_ts(u)
            ordered.append((ts, int(getattr(u, "id", 0) or 0), u))
        ordered.sort(key=lambda x: (x[0], x[1]))

        if limit and limit > 0:
            ordered = ordered[:limit]

        self.stdout.write(self.style.NOTICE(f"Backfill starting: users={len(ordered)}, pools={pools}, dry_run={dry}"))
        created_counts = {"FIVE_150": 0, "THREE_150": 0}
        skipped_counts = {"FIVE_150": 0, "THREE_150": 0}
        errors = 0

        for idx, (ts, uid, user) in enumerate(ordered, start=1):
            # Eligibility guard (again)
            if not is_matrix_eligible(user):
                continue

            # THREE_150 global placement (ignore sponsor)
            if "THREE_150" in pools:
                try:
                    exists3 = AutoPoolAccount.objects.filter(owner=user, pool_type="THREE_150", status="ACTIVE").exists()
                except Exception:
                    exists3 = False
                if not exists3:
                    if dry:
                        skipped_counts["THREE_150"] += 0  # noop; preview only
                    else:
                        try:
                            if self._try_place_three(user, base150, uid, ts):
                                created_counts["THREE_150"] += 1
                            else:
                                errors += 1
                        except Exception:
                            errors += 1
                else:
                    skipped_counts["THREE_150"] += 1

            # FIVE_150 sponsor-anchored backfill: ensure sponsor (if earlier/equal activation) is placed first
            if "FIVE_150" in pools:
                try:
                    exists5 = AutoPoolAccount.objects.filter(owner=user, pool_type="FIVE_150", status="ACTIVE").exists()
                except Exception:
                    exists5 = False
                if not exists5:
                    if not dry:
                        # If sponsor exists and was activated earlier/equal, ensure sponsor is placed first
                        try:
                            sponsor = getattr(user, "registered_by", None)
                        except Exception:
                            sponsor = None
                        if sponsor and is_matrix_eligible(sponsor):
                            try:
                                s_ts = self._resolve_activation_ts(sponsor)
                            except Exception:
                                s_ts = ts
                            if s_ts and s_ts <= ts:
                                try:
                                    has_sp = AutoPoolAccount.objects.filter(owner=sponsor, pool_type="FIVE_150", status="ACTIVE").exists()
                                except Exception:
                                    has_sp = False
                                if not has_sp:
                                    try:
                                        AutoPoolAccount.place_in_five_pool(
                                            sponsor,
                                            "FIVE_150",
                                            base150,
                                            source_type="BACKFILL",
                                            source_id=f"user:{getattr(sponsor, 'id', None)}|ts:{s_ts.isoformat()}|pre_sponsor",
                                        )
                                    except Exception:
                                        # proceed even if sponsor placement fails (child will fallback to sentinel)
                                        pass
                        try:
                            if self._try_place_five(user, base150, uid, ts):
                                created_counts["FIVE_150"] += 1
                            else:
                                errors += 1
                        except Exception:
                            errors += 1
                    else:
                        skipped_counts["FIVE_150"] += 0  # noop; preview only
                else:
                    skipped_counts["FIVE_150"] += 1

            if idx % 100 == 0:
                self.stdout.write(
                    f"- processed={idx} created5={created_counts.get('FIVE_150', 0)} "
                    f"created3={created_counts.get('THREE_150', 0)} errors={errors}"
                )

        # Final summary
        self.stdout.write(self.style.SUCCESS("Backfill complete"))
        self.stdout.write(
            f"Created: FIVE_150={created_counts.get('FIVE_150', 0)}, THREE_150={created_counts.get('THREE_150', 0)}"
        )
        self.stdout.write(
            f"Existing (skipped): FIVE_150={skipped_counts.get('FIVE_150', 0)}, THREE_150={skipped_counts.get('THREE_150', 0)}"
        )
        if errors:
            self.stdout.write(self.style.WARNING(f"Errors: {errors} (see logs)"))

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import re
from collections import defaultdict
from typing import DefaultDict, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta


@dataclass(frozen=True)
class ExpectedSeat:
    user_id: int
    pool_type: str
    source_type: str
    source_id: str
    kind: str


_MONTHLY_SOURCE_TYPES = {"MONTHLY_759", "MONTHLY_1000", "SMART_SSP"}


def _monthly_season_from_source_id(source_id: str) -> int:
    """Extract season/package_number from various historical MONTHLY source_id formats.

    Supported examples:
    - "637:1:4"                  -> 1
    - "admin_s1:1:1"             -> 1
    - "<purchase_id>:<season>:<box>" -> <season>
    """
    s = str(source_id or "").strip()
    if not s:
        return 0
    m = re.match(r"^admin_s(?P<season>\d+):", s, flags=re.IGNORECASE)
    if m:
        try:
            return int(m.group("season"))
        except Exception:
            return 0
    parts = s.split(":")
    # Common format is <purchase_id>:<season>:<box>
    if len(parts) >= 3:
        try:
            return int(parts[1])
        except Exception:
            return 0
    # Fallback: first integer-ish token
    for p in parts:
        try:
            v = int(p)
            if v > 0:
                return v
        except Exception:
            continue
    return 0


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


def _is_true(v: object) -> bool:
    return str(v or "").strip().lower() in ("1", "true", "yes", "y")


class Command(BaseCommand):
    help = (
        "Repair/backfill matrix positions derived from subscription sources (no wallet payouts).\n"
        "Sources covered:\n"
        "- PRIME 750 approved promo purchase => FIVE_150 + THREE_150\n"
        "- MONTHLY (759/1000) first-per-season => FIVE_150 + THREE_150\n"
        "- PRIME 150 approved promo purchase => FIVE_150 + THREE_150 (SELF_REBIRTH)\n"
        "- Self account allocation (WalletTransaction SELF_ACCOUNT_DEBIT) => FIVE_150 + THREE_150 (SELF_REBIRTH)\n"
        "- E-coupon 150 activation (CouponSubmission AGENCY_APPROVED, value=150) => FIVE_150 + THREE_150 (SELF_REBIRTH)\n"
        "\n"
        "Safe/idempotent: creates missing AutoPoolAccount entries only; does not delete or pay commissions."
    )

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing.")
        parser.add_argument("--apply", action="store_true", help="Apply changes (write to DB).")
        parser.add_argument("--limit", type=int, default=0, help="Cap number of missing seats to create (0=no cap).")
        parser.add_argument(
            "--user-id",
            type=int,
            default=0,
            help="Only repair this user id (0=all).",
        )
        parser.add_argument(
            "--username",
            type=str,
            default="",
            help="Only repair this username/phone (alternative to --user-id).",
        )
        parser.add_argument(
            "--since-days",
            type=int,
            default=0,
            help="Optional lookback window for sources (0=all time).",
        )
        parser.add_argument(
            "--include-root",
            action="store_true",
            help="Include root/sentinel users in repair (default: excluded). Use with caution.",
        )
        parser.add_argument(
            "--rebirth-only-three",
            action="store_true",
            help="Create SELF_REBIRTH seats in THREE_150 only (default: create in BOTH FIVE_150 and THREE_150).",
        )
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Print per-seat actions.",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=200,
            help="Apply mode: commit creations in chunks (default 200).",
        )
        parser.add_argument(
            "--cleanup-monthly-duplicates",
            action="store_true",
            help="Apply mode: close duplicate MONTHLY seats per (user, pool, season) when safe (no children).",
        )

    def _root_user_ids(self) -> Set[int]:
        ids: Set[int] = set()
        try:
            from business.models import RootConsumerConfig

            rc = RootConsumerConfig.get_solo()
            ru = rc.get_root_user()
            if ru and getattr(ru, "id", None):
                ids.add(int(ru.id))
        except Exception:
            pass
        # Fallback known sentinel owner id
        ids.add(32)
        return ids

    def _resolve_user_filter(self, user_id: int, username: str) -> Dict[str, object]:
        flt: Dict[str, object] = {}
        if user_id and user_id > 0:
            flt["user_id"] = int(user_id)
        elif username:
            # username is stored on CustomUser.username
            flt["user__username"] = str(username).strip()
        return flt

    def _resolve_owner_filter(self, user_id: int, username: str) -> Dict[str, object]:
        flt: Dict[str, object] = {}
        if user_id and user_id > 0:
            flt["owner_id"] = int(user_id)
        elif username:
            flt["owner__username"] = str(username).strip()
        return flt

    def _equivalent_source_types_for(self, source_type: str, kind: str) -> Set[str]:
        s = str(source_type or "").upper()
        if kind == "PRIME_750":
            return {
                s,
                "PRIME_750",
                "PRIME750",
                "PROMO_PURCHASE",
                "PROMO_PURCHASE_APPROVAL",
                "SUBSCRIPTION_750",
                "BACKFILL_750",
            }
        if kind == "MONTHLY":
            return {s, "MONTHLY_759", "MONTHLY_1000", "SMART_SSP"}
        if kind == "SELF_REBIRTH":
            return {
                s,
                "PRIME_150",
                "PRIME150",
                "COUPON_150",
                "COUPON150",
                "ECOUPON",
                "ECOUPON_150_ACTIVATED",
                "SELF_250",
                "SELF_ACCOUNT",
                "SELF_ACCOUNT_250",
                "BACKFILL_150",
                "SELF_REBIRTH",
            }
        return {s} if s else set()

    def _seat_exists(self, *, user_id: int, pool_type: str, source_id: str, source_types: Set[str]) -> bool:
        from business.models import AutoPoolAccount

        try:
            return AutoPoolAccount.objects.filter(
                owner_id=int(user_id),
                pool_type=str(pool_type),
                status="ACTIVE",
                source_id=str(source_id),
                source_type__in=list(source_types or []),
            ).exists()
        except Exception:
            return False

    def _seat_exists_fast(
        self,
        *,
        seat: ExpectedSeat,
        existing_types_by_key: Dict[Tuple[int, str, str], Set[str]],
        existing_monthly_seasons: Set[Tuple[int, str, int]],
    ) -> bool:
        if seat.kind == "MONTHLY":
            season = _monthly_season_from_source_id(seat.source_id)
            if season > 0 and (int(seat.user_id), str(seat.pool_type), int(season)) in existing_monthly_seasons:
                return True
        key = (int(seat.user_id), str(seat.pool_type), str(seat.source_id))
        existing_types = existing_types_by_key.get(key) or set()
        if not existing_types:
            return False
        equiv = self._equivalent_source_types_for(seat.source_type, seat.kind)
        return bool(set(t.upper() for t in existing_types).intersection(set(x.upper() for x in (equiv or set()))))

    def _create_seat(self, *, seat: ExpectedSeat, user) -> bool:
        from business.models import AutoPoolAccount, is_matrix_eligible

        u = user
        # Avoid placing for sentinel/root owner (virtual root) and for ineligible users.
        if not is_matrix_eligible(u):
            return False

        if seat.pool_type == "FIVE_150":
            acc = AutoPoolAccount.create_five_150_for_user(
                u,
                amount=None,
                source_type=str(seat.source_type),
                source_id=str(seat.source_id),
                max_allowed=1,
            )
            return bool(acc)
        if seat.pool_type == "THREE_150":
            acc = AutoPoolAccount.create_three_150_for_user(
                u,
                amount=None,
                source_type=str(seat.source_type),
                source_id=str(seat.source_id),
                max_allowed=1,
            )
            return bool(acc)
        return False

    def handle(self, *args, **options):
        dry_run = bool(options.get("dry_run"))
        apply_flag = bool(options.get("apply"))
        do_apply = apply_flag and not dry_run
        if not apply_flag and not dry_run:
            # safest default: dry-run
            dry_run = True
            do_apply = False

        limit = int(options.get("limit") or 0)
        user_id = int(options.get("user_id") or 0)
        username = str(options.get("username") or "").strip()
        since_days = int(options.get("since_days") or 0)
        include_root = bool(options.get("include_root"))
        rebirth_only_three = bool(options.get("rebirth_only_three"))
        verbose = bool(options.get("verbose"))
        batch_size = int(options.get("batch_size") or 200)
        cleanup_monthly_dupes = bool(options.get("cleanup_monthly_duplicates"))

        from business.models import PromoPurchase
        from accounts.models import WalletTransaction
        from coupons.models import CouponSubmission

        # Ensure sentinel roots exist so placement has an anchor.
        try:
            from business.services.placement import _ensure_sentinel_root

            _ensure_sentinel_root("THREE_150")
            _ensure_sentinel_root("FIVE_150")
        except Exception:
            pass

        now = timezone.now()
        cutoff = None
        if since_days and since_days > 0:
            cutoff = now - timedelta(days=int(since_days))

        pp_user_filter = self._resolve_user_filter(user_id, username)
        mx_owner_filter = self._resolve_owner_filter(user_id, username)

        expected: List[ExpectedSeat] = []
        root_ids = set() if include_root else self._root_user_ids()

        # ----------------------------
        # 1) PRIME 750 purchases => FIVE + THREE
        # ----------------------------
        prime750_qs = PromoPurchase.objects.filter(
            status="APPROVED",
            package__type="PRIME",
            package__code__icontains="750",
            **pp_user_filter,
        )
        if cutoff is not None:
            prime750_qs = prime750_qs.filter(approved_at__gte=cutoff)
        prime750_qs = prime750_qs.order_by("user_id", "approved_at", "id").only("id", "user_id")

        for p in prime750_qs:
            pid = str(getattr(p, "id", "") or "")
            uid = int(getattr(p, "user_id", 0) or 0)
            if not uid or not pid or uid in root_ids:
                continue
            expected.append(ExpectedSeat(uid, "FIVE_150", "PRIME_750", pid, "PRIME_750"))
            expected.append(ExpectedSeat(uid, "THREE_150", "PRIME_750", pid, "PRIME_750"))

        # ----------------------------
        # 2) MONTHLY first-per-season => FIVE + THREE
        #    Keyed by (user_id, package_id, package_number)
        # ----------------------------
        monthly_qs = PromoPurchase.objects.filter(
            status="APPROVED",
            package__type="MONTHLY",
            **pp_user_filter,
        )
        if cutoff is not None:
            monthly_qs = monthly_qs.filter(approved_at__gte=cutoff)
        monthly_qs = (
            monthly_qs.order_by("user_id", "package_id", "package_number", "approved_at", "id")
            .values(
                "id",
                "user_id",
                "package_id",
                "package_number",
                "boxes_json",
                "month",
                "year",
                "package__code",
            )
        )

        seen_seasons: Set[Tuple[int, int, int]] = set()
        for p in monthly_qs:
            uid = int(p.get("user_id") or 0)
            pkg_id = int(p.get("package_id") or 0)
            if uid in root_ids:
                continue
            pkg_no = p.get("package_number")
            if pkg_no is None:
                pkg_no = p.get("month")
            try:
                pkg_no_int = int(pkg_no) if pkg_no is not None else 0
            except Exception:
                pkg_no_int = 0
            if not uid or not pkg_id or pkg_no_int <= 0:
                continue
            sk = (uid, pkg_id, pkg_no_int)
            if sk in seen_seasons:
                continue
            seen_seasons.add(sk)

            boxes = list(p.get("boxes_json") or [])
            try:
                boxes_int = [int(x) for x in boxes if int(x) > 0]
            except Exception:
                boxes_int = []
            box_no = min(boxes_int) if boxes_int else 1

            # Use a season-aware source_id format that the frontend can label.
            src_id = f"{int(p.get('id') or 0)}:{pkg_no_int}:{int(box_no)}"
            # Prefer using MONTHLY_759 tag (matcher expects 759/1000). If package code contains 1000, use MONTHLY_1000.
            src_type = "MONTHLY_759"
            try:
                pcode = str(p.get("package__code") or "").upper()
                if "1000" in pcode:
                    src_type = "MONTHLY_1000"
            except Exception:
                pass

            expected.append(ExpectedSeat(uid, "FIVE_150", src_type, src_id, "MONTHLY"))
            expected.append(ExpectedSeat(uid, "THREE_150", src_type, src_id, "MONTHLY"))

        # ----------------------------
        # 3) PRIME 150 purchases => FIVE + THREE (SELF_REBIRTH)
        # ----------------------------
        prime150_qs = PromoPurchase.objects.filter(
            status="APPROVED",
            package__type="PRIME",
            package__code__icontains="150",
            **pp_user_filter,
        ).exclude(package__code__icontains="750")
        if cutoff is not None:
            prime150_qs = prime150_qs.filter(approved_at__gte=cutoff)
        prime150_qs = prime150_qs.order_by("user_id", "approved_at", "id").only("id", "user_id")

        for p in prime150_qs:
            pid = str(getattr(p, "id", "") or "")
            uid = int(getattr(p, "user_id", 0) or 0)
            if not uid or not pid or uid in root_ids:
                continue
            if not rebirth_only_three:
                expected.append(ExpectedSeat(uid, "FIVE_150", "PRIME_150", pid, "SELF_REBIRTH"))
            expected.append(ExpectedSeat(uid, "THREE_150", "PRIME_150", pid, "SELF_REBIRTH"))

        # ----------------------------
        # 4) Self-account allocations (₹250 pack) => FIVE + THREE (SELF_REBIRTH)
        # ----------------------------
        self_qs = WalletTransaction.objects.filter(
            type="SELF_ACCOUNT_DEBIT",
            source_type="SELF_250_PACK",
            **({"user_id": user_id} if user_id else ({} if not username else {"user__username": username})),
        )
        if cutoff is not None:
            self_qs = self_qs.filter(created_at__gte=cutoff)
        self_qs = self_qs.order_by("user_id", "created_at", "id").only("id", "user_id")

        for t in self_qs:
            tid = str(getattr(t, "id", "") or "")
            uid = int(getattr(t, "user_id", 0) or 0)
            if not uid or not tid or uid in root_ids:
                continue
            if not rebirth_only_three:
                expected.append(ExpectedSeat(uid, "FIVE_150", "SELF_ACCOUNT_250", tid, "SELF_REBIRTH"))
            expected.append(ExpectedSeat(uid, "THREE_150", "SELF_ACCOUNT_250", tid, "SELF_REBIRTH"))

        # ----------------------------
        # 5) E-coupon 150 activations => FIVE + THREE (SELF_REBIRTH)
        # ----------------------------
        from decimal import Decimal as D

        ecoupon_qs = CouponSubmission.objects.filter(
            status="AGENCY_APPROVED",
            code_ref__value=D("150.00"),
            **({"consumer_id": user_id} if user_id else ({} if not username else {"consumer__username": username})),
        )
        if cutoff is not None:
            ecoupon_qs = ecoupon_qs.filter(created_at__gte=cutoff)
        ecoupon_qs = ecoupon_qs.order_by("consumer_id", "created_at", "id").only("id", "consumer_id")

        for s in ecoupon_qs:
            sid = str(getattr(s, "id", "") or "")
            uid = int(getattr(s, "consumer_id", 0) or 0)
            if not uid or not sid or uid in root_ids:
                continue
            if not rebirth_only_three:
                expected.append(ExpectedSeat(uid, "FIVE_150", "ECOUPON_150_ACTIVATED", sid, "SELF_REBIRTH"))
            expected.append(ExpectedSeat(uid, "THREE_150", "ECOUPON_150_ACTIVATED", sid, "SELF_REBIRTH"))

        # ----------------------------
        # Compare expected vs actual and create missing
        # ----------------------------
        if not expected:
            self.stdout.write(self.style.WARNING("No source events found to repair."))
            return

        expected = list(dict.fromkeys(expected))  # stable de-dupe
        self.stdout.write(
            self.style.NOTICE(
                f"Expected seats from sources: {len(expected)} (mode={'APPLY' if do_apply else 'DRY-RUN'})"
            )
        )

        # Bulk prefetch existing active seats for involved users to avoid per-seat DB .exists() calls.
        from business.models import AutoPoolAccount
        user_ids = sorted(set(int(s.user_id) for s in expected if int(s.user_id) > 0))
        existing_types_by_key: DefaultDict[Tuple[int, str, str], Set[str]] = defaultdict(set)
        existing_monthly_seasons: Set[Tuple[int, str, int]] = set()
        if user_ids:
            existing_rows = (
                AutoPoolAccount.objects.filter(
                    owner_id__in=user_ids,
                    status="ACTIVE",
                    pool_type__in=["FIVE_150", "THREE_150"],
                )
                .values("owner_id", "pool_type", "source_type", "source_id")
                .iterator(chunk_size=2000)
            )
            for r in existing_rows:
                oid = int(r.get("owner_id") or 0)
                pt = str(r.get("pool_type") or "")
                st = str(r.get("source_type") or "")
                sid = str(r.get("source_id") or "")
                if not oid or not pt:
                    continue
                existing_types_by_key[(oid, pt, sid)].add(st)
                if st.upper() in _MONTHLY_SOURCE_TYPES:
                    season = _monthly_season_from_source_id(sid)
                    if season > 0:
                        existing_monthly_seasons.add((oid, pt, season))

        missing: List[ExpectedSeat] = []
        for seat in expected:
            if self._seat_exists_fast(
                seat=seat,
                existing_types_by_key=existing_types_by_key,
                existing_monthly_seasons=existing_monthly_seasons,
            ):
                continue
            missing.append(seat)
            if limit > 0 and len(missing) >= limit:
                break

        self.stdout.write(self.style.NOTICE(f"Missing seats to create: {len(missing)}"))
        if not missing and not (do_apply and cleanup_monthly_dupes):
            self.stdout.write(self.style.SUCCESS("Nothing to do."))
            return
        if not missing:
            self.stdout.write(self.style.SUCCESS("Nothing new to create; continuing to cleanup."))

        if not do_apply:
            # Print sample
            sample = missing[: min(25, len(missing))]
            for s in sample:
                self.stdout.write(f"  would_create user={s.user_id} pool={s.pool_type} src={s.source_type}:{s.source_id} kind={s.kind}")
            if len(missing) > len(sample):
                self.stdout.write(f"  ... and {len(missing) - len(sample)} more")
            self.stdout.write(self.style.WARNING("Dry-run complete. Re-run with --apply to create missing seats."))
            return

        # Preload users to avoid per-seat user queries.
        from accounts.models import CustomUser

        users_by_id: Dict[int, object] = {}
        if user_ids:
            for u in CustomUser.objects.filter(id__in=user_ids).only(
                "id", "username", "category", "is_staff", "is_superuser"
            ):
                users_by_id[int(u.id)] = u

        created = 0
        failed = 0
        # Apply in chunks; each seat is wrapped in a savepoint so one failure doesn't poison the whole run.
        for i in range(0, len(missing), max(1, batch_size)):
            chunk = missing[i : i + max(1, batch_size)]
            with transaction.atomic():
                for s in chunk:
                    u = users_by_id.get(int(s.user_id))
                    if not u:
                        failed += 1
                        if verbose:
                            self.stdout.write(self.style.WARNING(
                                f"failed user={s.user_id} pool={s.pool_type} src={s.source_type}:{s.source_id} kind={s.kind}"
                            ))
                        continue
                    try:
                        with transaction.atomic():
                            ok = self._create_seat(seat=s, user=u)
                    except Exception:
                        ok = False
                    if ok:
                        created += 1
                        if verbose:
                            self.stdout.write(self.style.SUCCESS(
                                f"created user={s.user_id} pool={s.pool_type} src={s.source_type}:{s.source_id} kind={s.kind}"
                            ))
                    else:
                        failed += 1
                        if verbose:
                            self.stdout.write(self.style.WARNING(
                                f"failed user={s.user_id} pool={s.pool_type} src={s.source_type}:{s.source_id} kind={s.kind}"
                            ))

        # Optional cleanup: close duplicate MONTHLY seats per season when safe.
        if cleanup_monthly_dupes:
            # Only meaningful in apply mode.
            closed = 0
            skipped = 0
            monthly_qs = AutoPoolAccount.objects.filter(
                owner_id__in=user_ids,
                status="ACTIVE",
                pool_type__in=["FIVE_150", "THREE_150"],
                source_type__in=list(_MONTHLY_SOURCE_TYPES),
            ).only("id", "owner_id", "pool_type", "source_type", "source_id", "created_at", "parent_account")

            groups: DefaultDict[Tuple[int, str, int], List[AutoPoolAccount]] = defaultdict(list)
            for a in monthly_qs:
                season = _monthly_season_from_source_id(getattr(a, "source_id", ""))
                if season > 0:
                    groups[(int(a.owner_id), str(a.pool_type), int(season))].append(a)

            for gkey, arr in groups.items():
                if len(arr) <= 1:
                    continue
                # Prefer keeping the one with children; else oldest.
                def _score(x: AutoPoolAccount) -> Tuple[int, int]:
                    try:
                        child_ct = x.children.filter(status="ACTIVE").count()
                    except Exception:
                        child_ct = 0
                    return (1 if child_ct > 0 else 0, -int(x.id))

                keep = sorted(arr, key=_score, reverse=True)[0]
                for a in arr:
                    if a.id == keep.id:
                        continue
                    try:
                        child_ct = a.children.filter(status="ACTIVE").count()
                    except Exception:
                        child_ct = 0
                    if child_ct > 0:
                        skipped += 1
                        continue
                    try:
                        AutoPoolAccount.objects.filter(id=a.id, status="ACTIVE").update(status="CLOSED")
                        closed += 1
                    except Exception:
                        skipped += 1

            if verbose or closed or skipped:
                self.stdout.write("")
                self.stdout.write(self.style.MIGRATE_HEADING("Monthly Cleanup"))
                self.stdout.write(f"  Duplicate MONTHLY seats closed : {closed}")
                self.stdout.write(f"  Skipped (has children/error)    : {skipped}")

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Repair Summary"))
        self.stdout.write(f"  Missing seats identified : {len(missing)}")
        self.stdout.write(f"  Seats created            : {created}")
        self.stdout.write(f"  Seats failed/skipped     : {failed}")
        self.stdout.write(self.style.SUCCESS("Done."))

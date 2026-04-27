from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
import re
from collections import defaultdict
from typing import DefaultDict, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.db import connection
from django.db.models import Q
from django.utils import timezone
from datetime import timedelta
from django.db import close_old_connections


@dataclass(frozen=True)
class ExpectedSeat:
    user_id: int
    pool_type: str
    source_type: str
    source_id: str
    kind: str


# Monthly roots are Smart SSP entries that should appear under Smart SSP dropdown.
# New convention (2026-04): the season's first month uses MONTHLY_FIRST_SEASON-{season}
# so the UI can show a stable label.
_MONTHLY_SOURCE_TYPES = {"MONTHLY_759", "MONTHLY_1000", "SMART_SSP", "MONTHLY_FIRST_SEASON"}


def _is_monthly_source_type(source_type: str) -> bool:
    """Return True if this AutoPoolAccount.source_type represents a MONTHLY/Smart SSP seat.

    Supports:
      - legacy exact tags (MONTHLY_759, MONTHLY_1000, SMART_SSP)
      - new season-specific tag prefix: MONTHLY_FIRST_SEASON-{season}
    """
    try:
        st = str(source_type or "").strip().upper()
    except Exception:
        st = ""
    if not st:
        return False
    if st.startswith("MONTHLY_FIRST_SEASON"):
        return True
    return st in _MONTHLY_SOURCE_TYPES


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


def _monthly_first_season_source_type(season: int) -> str:
    try:
        season_int = int(season or 0)
    except Exception:
        season_int = 0
    return f"MONTHLY_FIRST_SEASON-{season_int}" if season_int > 0 else "MONTHLY_FIRST_SEASON"


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
            "--progress-every",
            type=int,
            default=100,
            help="Apply mode: print a progress line every N seats processed (default 100).",
        )
        parser.add_argument(
            "--cleanup-monthly-duplicates",
            action="store_true",
            help="Apply mode: close duplicate MONTHLY seats per (user, pool, season) when safe (no children).",
        )

        parser.add_argument(
            "--cleanup-prime750-duplicates",
            action="store_true",
            help=(
                "Apply mode: close duplicate PRIME_750 seats per (user, pool, promo_purchase_id) when safe (no ACTIVE children). "
                "This does NOT delete; it only changes status ACTIVE -> CLOSED for extra duplicates."
            ),
        )

        parser.add_argument(
            "--normalize-source-tags",
            action="store_true",
            help=(
                "Normalize existing ACTIVE AutoPoolAccount.source_type values to canonical tags derived from sources. "
                "Does not delete/recreate seats. Canonical tags include PRIME_750 / PRIME_150 / SELF_ACCOUNT_250 / "
                "ECOUPON_150_ACTIVATED / MONTHLY_FIRST_SEASON-{season}."
            ),
        )

        parser.add_argument(
            "--normalize-source-tags-sql",
            action="store_true",
            help=(
                "Postgres-only fast path for --normalize-source-tags. Performs set-based SQL UPDATEs instead of Python iteration. "
                "Falls back silently if not Postgres."
            ),
        )

    def _is_postgres(self) -> bool:
        try:
            return connection.vendor == "postgresql"
        except Exception:
            return False

    def _normalize_tags_sql(self, *, user_ids: Sequence[int], verbose: bool = False) -> int:
        """Fast Postgres-only tag normalization.

        Updates business_autopoolaccount.source_type in bulk for ACTIVE seats:
          - PROMO_PURCHASE_APPROVAL/other legacy prime tags -> PRIME_750
          - MONTHLY/SMART/SSP tags -> MONTHLY_FIRST_SEASON-<season>

        Note: This is intentionally conservative and only updates rows we can infer safely.
        """
        if not user_ids:
            return 0
        if not self._is_postgres():
            return 0

        # We keep SQL in small statements for safety + explainability.
        # 1) PRIME_750: update promo purchase seats with legacy tags.
        #    Join on source_id = promopurchase.id (stored as string in source_id).
        user_id_list = list({int(x) for x in user_ids if int(x) > 0})
        if not user_id_list:
            return 0

        updated_total = 0
        with connection.cursor() as cur:
            # PRIME 750 canonical tag
            cur.execute(
                """
                UPDATE business_autopoolaccount a
                SET source_type = 'PRIME_750'
                FROM business_promopurchase pp
                JOIN business_promopackage pkg ON pkg.id = pp.package_id
                WHERE a.status = 'ACTIVE'
                  AND a.pool_type IN ('FIVE_150','THREE_150')
                  AND a.owner_id = ANY(%s)
                  AND pp.id::text = a.source_id
                  AND pp.status = 'APPROVED'
                  AND pkg.type = 'PRIME'
                  AND upper(pkg.code) LIKE '%%750%%'
                  AND upper(coalesce(a.source_type,'')) IN (
                        'PROMO_PURCHASE_APPROVAL',
                        'PROMO_PURCHASE',
                        'SUBSCRIPTION_750',
                        'BACKFILL_750',
                        'PRIME750'
                  )
                """,
                [user_id_list],
            )
            updated_total += int(getattr(cur, "rowcount", 0) or 0)

            # MONTHLY canonical tag: MONTHLY_FIRST_SEASON-<season>
            # Infer season from source_id patterns:
            #   - '<purchase_id>:<season>:<box>'
            #   - 'admin_s<season>:<..>'
            # We only update rows that look monthly-ish.
            cur.execute(
                """
                UPDATE business_autopoolaccount a
                SET source_type = (
                    'MONTHLY_FIRST_SEASON-' || (
                        CASE
                            WHEN a.source_id ~* '^admin_s\\d+:' THEN
                                substring(a.source_id from '^admin_s(\\d+):')
                            WHEN a.source_id ~ '^[0-9]+:[0-9]+:' THEN
                                split_part(a.source_id, ':', 2)
                            ELSE NULL
                        END
                    )
                )
                WHERE a.status = 'ACTIVE'
                  AND a.pool_type IN ('FIVE_150','THREE_150')
                  AND a.owner_id = ANY(%s)
                  AND (
                        upper(coalesce(a.source_type,'')) LIKE '%%MONTHLY%%'
                        OR upper(coalesce(a.source_type,'')) LIKE '%%SMART%%'
                        OR upper(coalesce(a.source_type,'')) LIKE '%%SSP%%'
                  )
                  AND (
                        a.source_id ~* '^admin_s\\d+:'
                        OR a.source_id ~ '^[0-9]+:[0-9]+:'
                  )
                  AND upper(coalesce(a.source_type,'')) NOT LIKE 'MONTHLY_FIRST_SEASON%%'
                """,
                [user_id_list],
            )
            updated_total += int(getattr(cur, "rowcount", 0) or 0)

        if verbose:
            try:
                self.stdout.write(self.style.NOTICE(f"SQL tag normalization updated rows: {updated_total}"))
            except Exception:
                pass
        return updated_total

    def _should_use_sql_tag_normalization(self, *, do_apply: bool, normalize_tags: bool, normalize_tags_sql: bool) -> bool:
        # Only applies when asked and when DB backend supports it.
        return bool(do_apply and normalize_tags and normalize_tags_sql and self._is_postgres())

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
            # include new season-specific tag and legacy tags
            return {s, "MONTHLY_759", "MONTHLY_1000", "SMART_SSP", "MONTHLY_FIRST_SEASON"}
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

        # Stronger idempotency guard (generic):
        # If ANY ACTIVE seat already exists for the same (owner, pool_type, source_id), do not create another.
        # This prevents duplicate creation when historical rows used legacy/incorrect source_type tags.
        # Monthly is excluded because it is season-based (we de-dupe by season above).
        if seat.kind != "MONTHLY":
            return True
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
        progress_every = int(options.get("progress_every") or 100)
        cleanup_monthly_dupes = bool(options.get("cleanup_monthly_duplicates"))
        cleanup_prime750_dupes = bool(options.get("cleanup_prime750_duplicates"))
        normalize_tags = bool(options.get("normalize_source_tags"))
        normalize_tags_sql = bool(options.get("normalize_source_tags_sql"))

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
            # New tag: season-first month must be visible in UI Smart SSP dropdown as Season N.
            # We keep the seat source_id format unchanged so existing season extract works.
            src_type = _monthly_first_season_source_type(pkg_no_int)
            try:
                pcode = str(p.get("package__code") or "").upper()
                # Keep 1000 info in meta for future differentiation if needed.
                # For now, UI groups both under SMART_SSP, and seat identity is season-specific.
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
                if _is_monthly_source_type(st):
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

        # ----------------------------
        # Optional: normalize existing source_type tags (no delete/recreate)
        # ----------------------------
        # Build desired source_type per (user,pool,source_id) from expected seats.
        desired_by_key: Dict[Tuple[int, str, str], str] = {}
        try:
            for s in expected:
                desired_by_key[(int(s.user_id), str(s.pool_type), str(s.source_id))] = str(s.source_type)
        except Exception:
            desired_by_key = {}

        tag_updates_preview: List[Tuple[int, str, str, str, str]] = []  # (id, pool, source_id, old, new)
        tag_updates_count = 0
        if normalize_tags:
            try:
                # Postgres fast path: do normalization in SQL (much faster for full-history runs).
                # In apply mode, if SQL normalization is enabled, we will run it and then skip the expensive Python bulk_update.
                used_sql_norm = self._should_use_sql_tag_normalization(
                    do_apply=do_apply,
                    normalize_tags=normalize_tags,
                    normalize_tags_sql=normalize_tags_sql,
                )
                sql_updated = 0
                if used_sql_norm:
                    sql_updated = self._normalize_tags_sql(user_ids=user_ids, verbose=verbose)

                # Iterate all existing ACTIVE accounts for the user set.
                # Monthly is handled by season extraction even if source_id format is legacy.
                existing_qs = (
                    AutoPoolAccount.objects.filter(
                        owner_id__in=user_ids,
                        status="ACTIVE",
                        pool_type__in=["FIVE_150", "THREE_150"],
                    )
                    .only("id", "owner_id", "pool_type", "source_type", "source_id")
                    .iterator(chunk_size=2000)
                )

                # Apply canonical tag for monthly seats based on parsed season.
                # This works even when source_id is "admin_s1:1:1" or other legacy patterns.
                def _monthly_canonical_for(acc_source_id: str) -> str:
                    season = _monthly_season_from_source_id(acc_source_id)
                    return _monthly_first_season_source_type(season)

                for a in existing_qs:
                    try:
                        oid = int(getattr(a, "owner_id", 0) or 0)
                        pt = str(getattr(a, "pool_type", "") or "")
                        sid = str(getattr(a, "source_id", "") or "")
                        old = str(getattr(a, "source_type", "") or "")
                        aid = int(getattr(a, "id", 0) or 0)
                    except Exception:
                        continue
                    if not oid or not pt or not aid:
                        continue

                    new_tag = ""
                    # Priority 1: Monthly seats are always canonicalized by season.
                    if _is_monthly_source_type(old) or (sid and _monthly_season_from_source_id(sid) > 0 and ("MONTHLY" in old.upper() or "SSP" in old.upper() or "SMART" in old.upper())):
                        new_tag = _monthly_canonical_for(sid)
                    else:
                        # Priority 2: Exact expected-key match (PRIME_750 / PRIME_150 / SELF_ACCOUNT_250 / ECOUPON_150_ACTIVATED)
                        new_tag = desired_by_key.get((oid, pt, sid)) or ""

                    if new_tag and str(old).strip().upper() != str(new_tag).strip().upper():
                        tag_updates_count += 1
                        if len(tag_updates_preview) < 25:
                            tag_updates_preview.append((aid, pt, sid, old, new_tag))
            except Exception:
                tag_updates_preview = []
                tag_updates_count = 0

        if normalize_tags:
            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING("Source Tag Normalization"))
            self.stdout.write(f"  Seats requiring source_type update : {tag_updates_count}")
            for (aid, pt, sid, old, new_tag) in tag_updates_preview:
                self.stdout.write(f"  would_update id={aid} pool={pt} source_id={sid} {old} -> {new_tag}")
            if tag_updates_count > len(tag_updates_preview):
                self.stdout.write(f"  ... and {tag_updates_count - len(tag_updates_preview)} more")

        if not missing and not (do_apply and (cleanup_monthly_dupes or cleanup_prime750_dupes or normalize_tags)):
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
            self.stdout.write(self.style.WARNING(
                "Dry-run complete. Re-run with --apply to create missing seats"
                + (" and --normalize-source-tags to normalize tags." if normalize_tags else ".")
            ))
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
        processed = 0
        # Apply in chunks; each seat is wrapped in a savepoint so one failure doesn't poison the whole run.
        for i in range(0, len(missing), max(1, batch_size)):
            chunk = missing[i : i + max(1, batch_size)]
            # IMPORTANT:
            # Do NOT wrap large chunks in a single outer transaction.
            # Placement internally uses transactions/locks; keeping a long outer atomic can lead to
            # "idle in transaction" sessions that block DDL and slow down the system.
            for s in chunk:
                processed += 1
                u = users_by_id.get(int(s.user_id))
                if not u:
                    failed += 1
                    if verbose:
                        self.stdout.write(self.style.WARNING(
                            f"failed user={s.user_id} pool={s.pool_type} src={s.source_type}:{s.source_id} kind={s.kind}"
                        ))
                    continue

                # Ensure we don't keep stale/long-lived connections in bad states.
                # This also helps avoid long "idle in transaction" sessions when iterators/cursors are used.
                try:
                    close_old_connections()
                except Exception:
                    pass

                try:
                    # One savepoint per seat: failures won't poison the whole run.
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

                if progress_every > 0 and processed % max(1, progress_every) == 0:
                    try:
                        # Use plain output for maximum compatibility.
                        # Some environments/styles can swallow NOTICE formatting during long runs.
                        self.stdout.write(
                            f"Progress: processed={processed}/{len(missing)} created={created} failed={failed}"
                        )
                    except Exception:
                        pass

        # Optional cleanup: close duplicate MONTHLY seats per season when safe.
        if cleanup_monthly_dupes:
            # Only meaningful in apply mode.
            closed = 0
            skipped = 0
            monthly_qs = AutoPoolAccount.objects.filter(
                owner_id__in=user_ids,
                status="ACTIVE",
                pool_type__in=["FIVE_150", "THREE_150"],
            ).filter(
                Q(source_type__in=list(_MONTHLY_SOURCE_TYPES))
                | Q(source_type__istartswith="MONTHLY_FIRST_SEASON")
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

        # Optional cleanup: close duplicate PRIME_750 seats per (user, pool, promo_purchase_id) when safe.
        # This prevents UI confusion and fixes historical duplicate creation.
        if cleanup_prime750_dupes:
            closed = 0
            skipped = 0
            skipped_examples: List[Tuple[int, str, str, int]] = []  # (owner_id,pool,source_id,children)
            prime_qs = AutoPoolAccount.objects.filter(
                owner_id__in=user_ids,
                status="ACTIVE",
                pool_type__in=["FIVE_150", "THREE_150"],
                source_type="PRIME_750",
            ).only("id", "owner_id", "pool_type", "source_type", "source_id", "created_at", "parent_account")

            groups2: DefaultDict[Tuple[int, str, str], List[AutoPoolAccount]] = defaultdict(list)
            for a in prime_qs:
                sid = str(getattr(a, "source_id", "") or "")
                if not sid:
                    continue
                groups2[(int(a.owner_id), str(a.pool_type), sid)].append(a)

            for _gkey, arr in groups2.items():
                if len(arr) <= 1:
                    continue
                # Prefer keeping the one with children; else keep the oldest (lowest id)
                def _score2(x: AutoPoolAccount) -> Tuple[int, int]:
                    try:
                        child_ct = x.children.filter(status="ACTIVE").count()
                    except Exception:
                        child_ct = 0
                    # higher is better: has_children first; then older id (smaller id)
                    return (1 if child_ct > 0 else 0, -int(x.id))

                keep = sorted(arr, key=_score2, reverse=True)[0]
                for a in arr:
                    if a.id == keep.id:
                        continue
                    try:
                        child_ct = a.children.filter(status="ACTIVE").count()
                    except Exception:
                        child_ct = 0
                    if child_ct > 0:
                        skipped += 1
                        if len(skipped_examples) < 10:
                            skipped_examples.append(
                                (int(a.owner_id), str(a.pool_type), str(a.source_id), int(child_ct))
                            )
                        continue
                    try:
                        AutoPoolAccount.objects.filter(id=a.id, status="ACTIVE").update(status="CLOSED")
                        closed += 1
                    except Exception:
                        skipped += 1

            if verbose or closed or skipped:
                self.stdout.write("")
                self.stdout.write(self.style.MIGRATE_HEADING("PRIME_750 Cleanup"))
                self.stdout.write(f"  Duplicate PRIME_750 seats closed : {closed}")
                self.stdout.write(f"  Skipped (has children/error)     : {skipped}")
                if skipped_examples:
                    self.stdout.write("  Sample skipped (has children):")
                    for (oid, pt, sid, cc) in skipped_examples:
                        self.stdout.write(
                            f"    owner_id={oid} pool={pt} source_id={sid} active_children={cc}"
                        )

        # Optional tag normalization: update source_type in-place for existing ACTIVE seats.
        if normalize_tags:
            # If Postgres SQL path was enabled in apply-mode, skip Python bulk_update entirely.
            updated = 0
            if self._should_use_sql_tag_normalization(
                do_apply=do_apply,
                normalize_tags=normalize_tags,
                normalize_tags_sql=normalize_tags_sql,
            ):
                try:
                    updated = 0  # already updated by SQL; we don't double-run
                except Exception:
                    updated = 0
            else:
                try:
                    # Re-scan existing rows and apply updates using bulk_update.
                    to_update = []
                    existing_qs2 = (
                        AutoPoolAccount.objects.filter(
                            owner_id__in=user_ids,
                            status="ACTIVE",
                            pool_type__in=["FIVE_150", "THREE_150"],
                        )
                        .only("id", "owner_id", "pool_type", "source_type", "source_id")
                        .iterator(chunk_size=2000)
                    )

                    for a in existing_qs2:
                        oid = int(getattr(a, "owner_id", 0) or 0)
                        pt = str(getattr(a, "pool_type", "") or "")
                        sid = str(getattr(a, "source_id", "") or "")
                        old = str(getattr(a, "source_type", "") or "")

                        new_tag = ""
                        if _is_monthly_source_type(old) or (
                            sid
                            and _monthly_season_from_source_id(sid) > 0
                            and ("MONTHLY" in old.upper() or "SSP" in old.upper() or "SMART" in old.upper())
                        ):
                            new_tag = _monthly_first_season_source_type(_monthly_season_from_source_id(sid))
                        else:
                            new_tag = desired_by_key.get((oid, pt, sid)) or ""

                        if new_tag and old.strip().upper() != new_tag.strip().upper():
                            a.source_type = new_tag
                            to_update.append(a)

                    if to_update:
                        for i in range(0, len(to_update), max(1, batch_size)):
                            chunk = to_update[i : i + max(1, batch_size)]
                            AutoPoolAccount.objects.bulk_update(
                                chunk, ["source_type"], batch_size=max(1, batch_size)
                            )
                        updated = len(to_update)
                except Exception:
                    updated = 0

            self.stdout.write("")
            self.stdout.write(self.style.MIGRATE_HEADING("Source Tag Normalization"))
            self.stdout.write(f"  Seats updated (source_type)     : {updated}")

        self.stdout.write("")
        self.stdout.write(self.style.MIGRATE_HEADING("Repair Summary"))
        self.stdout.write(f"  Missing seats identified : {len(missing)}")
        self.stdout.write(f"  Seats created            : {created}")
        self.stdout.write(f"  Seats failed/skipped     : {failed}")
        self.stdout.write(self.style.SUCCESS("Done."))

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q, Count
from django.utils.timezone import make_aware

from accounts.models import CustomUser
from business.models import (
    AutoPoolAccount,
    CommissionConfig,
    SubscriptionActivation,
    PromoPurchase,
    PromoMonthlyBox,
    is_matrix_eligible,
)
from business.services.placement import NoCapacityError, MaxDepthError, _ensure_sentinel_root
import json
import time


class Command(BaseCommand):
    help = (
        "Rebuild FIVE_150 and THREE_150 matrices based on PRIME purchases (supports multiplicity).\n"
        "- For each eligible consumer:\n"
        "   • PRIME 150: opens both 3 & 5 matrices once per activation event (SubscriptionActivation rows).\n"
        "   • PRIME 750: opens both 3 & 5 matrices once per APPROVED purchase (one per purchase row).\n"
        "   • PRIME 759: opens both 3 & 5 matrices only once (first month/first box event).\n"
        "- Events are ordered by their timestamps (ts asc, then user id asc, then event id asc) for deterministic placement.\n"
        "- FIVE_150 placement is sponsor-anchored; THREE_150 uses global sentinel root.\n"
        "- No wallet payouts are issued (source_type='REBUILD').\n"
        "\n"
        "Modes:\n"
        "  --dry-run           : Preview counts and a sample of planned events. Writes backend/logs/rebuild_mx_preview.json\n"
        "  --apply             : Apply full rebuild (CLOSE all ACTIVE non-sentinel rows in selected pools then re-create per events)\n"
        "  --dedupe-only       : For FIVE_150 only, if an owner has more ACTIVE entries than their computed event count, CLOSE extras (keep earliest). Non-destructive to others.\n"
        "\n"
        "Filters:\n"
        "  --pools FIVE_150,THREE_150   : Limit pools to rebuild (default both)\n"
        "  --start-after-user-id N      : Skip users with id <= N (chunked runs)\n"
        "  --limit N                    : Process at most N users in this run\n"
        "  --out path                   : Write preview/result JSON to this path (default backend/logs/rebuild_mx_preview.json and ...post_preview.json)\n"
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview only, do not modify DB.")
        parser.add_argument("--apply", action="store_true", help="Apply rebuild (mutates DB).")
        parser.add_argument(
            "--pools", type=str, default="FIVE_150,THREE_150", help="Comma-separated pools to rebuild: FIVE_150,THREE_150"
        )
        parser.add_argument("--start-after-user-id", type=int, default=0, help="Skip users with id <= this value.")
        parser.add_argument("--limit", type=int, default=0, help="Limit number of users processed.")
        parser.add_argument(
            "--dedupe-only",
            action="store_true",
            help="For FIVE_150 only: close duplicate ACTIVE rows beyond computed event count per owner (keeps earliest).",
        )
        parser.add_argument("--out", type=str, default="", help="Optional output path for JSON preview/result.")

    # ---------- Event collectors (multiplicity) ----------
    def _events_150(self, user: CustomUser) -> List[Tuple[datetime, str, str, str]]:
        """
        Returns list of (ts, kind, src_type, src_id) for PRIME 150 activation events.
        We rely on SubscriptionActivation packages for 150-type events.
        """
        out: List[Tuple[datetime, str, str, str]] = []
        try:
            rows = (
                SubscriptionActivation.objects.filter(
                    user=user, package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME")
                )
                .only("id", "created_at", "source_type", "source_id")
                .order_by("created_at", "id")
            )
            for r in rows:
                ts = getattr(r, "created_at", None)
                if ts:
                    out.append(
                        (
                            ts,
                            "P150",
                            str(getattr(r, "source_type", "") or "SUB_ACT"),
                            f"SUB_ACT:{getattr(r, 'id', None)}:{getattr(r, 'source_id', '')}",
                        )
                    )
        except Exception:
            pass
        return out

    def _events_750(self, user: CustomUser) -> List[Tuple[datetime, str, str, str]]:
        """
        Returns one event per APPROVED PRIME 750 purchase row.
        Quantity is treated as a single purchase event (historically each purchase opens both matrices once).
        """
        out: List[Tuple[datetime, str, str, str]] = []
        try:
            qs = (
                PromoPurchase.objects.filter(user=user, status="APPROVED")
                .filter(
                    Q(package__code__iexact="PRIME750")
                    | Q(package__code__iexact="RS750")
                    | Q(package__code__iexact="PRIME_750")
                )
                .only("id", "requested_at", "approved_at")
                .order_by("approved_at", "requested_at", "id")
            )
            for r in qs:
                ts = getattr(r, "approved_at", None) or getattr(r, "requested_at", None)
                if ts:
                    out.append((ts, "P750", "PROMO_PURCHASE", f"PP:{getattr(r, 'id', None)}"))
        except Exception:
            pass
        return out

    def _event_759_first(self, user: CustomUser) -> Optional[Tuple[datetime, str, str, str]]:
        """
        Returns at most one event for the first 759 monthly purchase/box (opens both matrices only once).
        We use earliest PromoMonthlyBox.created_at as the trigger, if any rows exist.
        """
        try:
            row = (
                PromoMonthlyBox.objects.filter(user=user)
                .only("id", "created_at")
                .order_by("created_at", "id")
                .first()
            )
            if row and getattr(row, "created_at", None):
                return (row.created_at, "P759", "MONTHLY_BOX", f"PMB:{getattr(row, 'id', None)}")
        except Exception:
            pass
        return None

    def _gather_events(self, user: CustomUser) -> List[Tuple[datetime, str, str, str]]:
        """
        Combine all events per user with multiplicity rules:
          - all P150 activations (each one)
          - all P750 APPROVED purchases (each one)
          - first P759 box only (at most one)
        """
        evs = []
        evs.extend(self._events_150(user))
        evs.extend(self._events_750(user))
        e759 = self._event_759_first(user)
        if e759:
            evs.append(e759)
        # sanitize and sort
        cleaned = []
        for (ts, kind, st, sid) in evs:
            if ts is None:
                continue
            cleaned.append((ts, str(kind or ""), str(st or ""), str(sid or "")))
        # Deterministic order: ts asc, then kind, then source_id string
        cleaned.sort(key=lambda x: (x[0], x[1], x[3]))
        return cleaned

    # ---------- Eligibility and roots ----------
    def _root_user_ids(self) -> List[int]:
        ids: List[int] = []
        try:
            from business.models import RootConsumerConfig
            rc = RootConsumerConfig.get_solo()
            ru = rc.get_root_user()
            if ru and getattr(ru, "id", None):
                ids.append(int(ru.id))
        except Exception:
            pass
        # historical sentinel fallback id
        if 32 not in ids:
            ids.append(32)
        return ids

    def _eligible_users_queryset(self, start_after_user_id: int = 0):
        base = CustomUser.objects.filter(category="consumer", is_staff=False, is_superuser=False)
        roots = self._root_user_ids()
        if start_after_user_id > 0:
            base = base.filter(id__gt=start_after_user_id)
        # Keep columns narrow
        return (
            base.exclude(id__in=roots)
            .order_by("id")
            .only("id", "username", "date_joined", "first_purchase_activated_at", "registered_by_id", "role", "category")
        )

    # ---------- Dedupe (FIVE_150 only; guided by computed event counts) ----------
    def _dedupe_five_matrix(self, dry: bool, user_to_expected: Dict[int, int]) -> Dict[str, int]:
        """
        For FIVE_150, if an owner has more ACTIVE entries than computed events, CLOSE extras keeping the earliest ACTIVE rows.
        Does not reshuffle children; CLOSED rows remain as history but ignored by placement.
        """
        stats = {"owners_considered": 0, "closed": 0}
        owners = list(
            AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE")
            .exclude(parent_account__isnull=True)
            .values("owner_id")
            .annotate(c=Count("id"))
            .values_list("owner_id", flat=True)
        )
        owners = [int(x) for x in owners if x]
        stats["owners_considered"] = len(owners)
        if not owners:
            return stats
        for oid in owners:
            want = int(user_to_expected.get(int(oid), 0) or 0)
            rows = list(
                AutoPoolAccount.objects.filter(pool_type="FIVE_150", status="ACTIVE", owner_id=int(oid))
                .exclude(parent_account__isnull=True)
                .order_by("created_at", "id")
                .values_list("id", flat=True)
            )
            have = len(rows)
            if have <= want:
                continue
            # Close extras after the first 'want' rows
            to_close = [int(x) for x in rows[want:]]
            if to_close and not dry:
                AutoPoolAccount.objects.filter(id__in=to_close, pool_type="FIVE_150", status="ACTIVE").update(status="CLOSED")
            stats["closed"] += len(to_close)
        return stats

    # ---------- Build ordered user list with event counts ----------
    def _plan(self, start_after_user_id: int, limit: int) -> Tuple[List[Tuple[int, str, datetime, int, str, str]], Dict[int, int]]:
        """
        Build a global ordered plan of events across users.
        Returns:
          - events: list of (user_id, pool, ts, seq, kind, source_id) ordered by ts asc then user id
                   pool value is placeholder '', actual creation will handle both pools per event.
          - expected_five_per_user: owner_id -> expected FIVE_150 count (for dedupe-only)
        """
        qs = self._eligible_users_queryset(start_after_user_id=start_after_user_id)
        users = list(qs)
        if limit and limit > 0:
            users = users[:limit]

        events: List[Tuple[int, str, datetime, int, str, str]] = []
        expected_five_per_user: Dict[int, int] = {}

        for u in users:
            if not is_matrix_eligible(u):
                continue
            evs = self._gather_events(u)
            if not evs:
                continue
            # Both pools for each event; track expected count for FIVE_150 (same as number of events)
            expected_five_per_user[int(u.id)] = len(evs)
            for idx, (ts, kind, st, sid) in enumerate(evs, start=1):
                # We store a single row per event; during apply we will create both pools (if selected)
                events.append((int(u.id), "", ts, idx, kind, sid))

        # Global deterministic ordering: by ts asc, then user id asc, then event seq asc
        events.sort(key=lambda r: (r[2], r[0], r[3]))
        return (events, expected_five_per_user)

    # ---------- Main ----------
    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        do_apply = bool(options.get("apply"))
        dedupe_only = bool(options.get("dedupe_only"))
        pools_in = str(options.get("pools") or "FIVE_150,THREE_150").upper().replace(" ", "")
        pools = [p for p in pools_in.split(",") if p in ("FIVE_150", "THREE_150")]
        start_after_user_id = int(options.get("start_after_user_id") or 0)
        limit = int(options.get("limit") or 0)
        out_opt = str(options.get("out") or "").strip()

        if not pools:
            self.stdout.write(self.style.ERROR("No valid pools selected. Choose from FIVE_150,THREE_150"))
            return
        if not dry and not do_apply and not dedupe_only:
            self.stdout.write(self.style.ERROR("Specify one of --dry-run, --apply, or --dedupe-only"))
            return

        # Output paths
        try:
            base_dir = None
            for p in Path(__file__).resolve().parents:
                if p.name == "backend":
                    base_dir = p
                    break
            if base_dir is None:
                base_dir = Path.cwd()
            logs_dir = base_dir / "logs"
            logs_dir.mkdir(parents=True, exist_ok=True)
            preview_path = Path(out_opt) if out_opt else (logs_dir / "rebuild_mx_preview.json")
            post_path = logs_dir / "rebuild_mx_post_preview.json"
        except Exception:
            preview_path = Path("rebuild_mx_preview.json")
            post_path = Path("rebuild_mx_post_preview.json")

        # Ensure sentinels exist for stability (no-ops if already)
        for p in pools:
            try:
                _ensure_sentinel_root(p)
            except Exception:
                pass

        # Compute global plan
        events, expected_five = self._plan(start_after_user_id=start_after_user_id, limit=limit)

        # Preview document
        plan_doc = {
            "mode": ("dedupe_only" if dedupe_only else ("apply" if do_apply else "dry_run")),
            "pools": pools,
            "total_users": len({e[0] for e in events}),
            "total_events": len(events),
            "expected_five_matrix_entries": sum(expected_five.values()),
            "sample_events": [
                {
                    "user_id": e[0],
                    "ts": (e[2].isoformat() if hasattr(e[2], "isoformat") else str(e[2])),
                    "event_seq": e[3],
                    "kind": e[4],
                    "source_id": e[5],
                }
                for e in events[:100]
            ],
        }
        try:
            with open(preview_path, "w", encoding="utf-8") as f:
                json.dump(plan_doc, f, ensure_ascii=False, indent=2, default=str)
        except Exception:
            pass

        if dry:
            self.stdout.write(self.style.WARNING("Dry-run only. Preview written."))
            return

        if dedupe_only:
            self.stdout.write(self.style.NOTICE("Running FIVE_150 dedupe-only (close extras beyond computed event counts)..."))
            stats = self._dedupe_five_matrix(dry=False, user_to_expected=expected_five)
            self.stdout.write(self.style.SUCCESS(f"Dedupe complete. Owners considered={stats['owners_considered']}, closed={stats['closed']}"))
            # Post summary
            try:
                with open(post_path, "w", encoding="utf-8") as f:
                    json.dump({"mode": "dedupe_only", "stats": stats}, f, ensure_ascii=False, indent=2, default=str)
            except Exception:
                pass
            return

        # APPLY flow: close all ACTIVE non-sentinel rows in selected pools, then create per-event
        # Close phase
        for p in pools:
            try:
                with transaction.atomic():
                    qs = AutoPoolAccount.objects.select_for_update().filter(pool_type=p, status="ACTIVE").exclude(parent_account__isnull=True)
                    n = qs.update(status="CLOSED")
                    self.stdout.write(self.style.HTTP_INFO(f"Closed ACTIVE non-sentinel in {p}: {n}"))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Failed to pre-close in {p}: {e}"))

        # Create phase (both pools per event if selected)
        created_counts = {"FIVE_150": 0, "THREE_150": 0}
        errors = 0

        for idx, (uid, _pool_placeholder, ts, seq, kind, srcid) in enumerate(events, start=1):
            user = CustomUser.objects.filter(id=int(uid)).first()
            if not user or not is_matrix_eligible(user):
                continue

            # Amount tagging per event kind (for record-keeping only; placement ignores amounts)
            if kind == "P150":
                amount_3 = Decimal("150.00")
                amount_5 = Decimal("150.00")
            elif kind == "P750":
                amount_3 = Decimal("750.00")
                amount_5 = Decimal("750.00")
            elif kind == "P759":
                amount_3 = Decimal("759.00")
                amount_5 = Decimal("759.00")
            else:
                amount_3 = Decimal("150.00")
                amount_5 = Decimal("150.00")

            src_type = f"REBUILD_{kind}"
            src_id = f"{srcid}|user:{uid}|seq:{seq}"

            # THREE_150 first (global)
            if "THREE_150" in pools:
                try:
                    AutoPoolAccount.place_in_three_pool(
                        user,
                        "THREE_150",
                        amount_3,
                        source_type=src_type,
                        source_id=src_id,
                    )
                    created_counts["THREE_150"] += 1
                except (NoCapacityError, MaxDepthError):
                    ok = False
                    for a in range(2):
                        time.sleep(0.05 * (a + 1))
                        try:
                            AutoPoolAccount.place_in_three_pool(
                                user,
                                "THREE_150",
                                amount_3,
                                source_type=src_type,
                                source_id=f"{src_id}|retry{a+1}",
                            )
                            created_counts["THREE_150"] += 1
                            ok = True
                            break
                        except Exception:
                            continue
                    if not ok:
                        errors += 1
                except Exception:
                    errors += 1

            # FIVE_150 (sponsor-anchored)
            if "FIVE_150" in pools:
                try:
                    AutoPoolAccount.place_in_five_pool(
                        user,
                        "FIVE_150",
                        amount_5,
                        source_type=src_type,
                        source_id=src_id,
                    )
                    created_counts["FIVE_150"] += 1
                except (NoCapacityError, MaxDepthError):
                    ok2 = False
                    for a in range(2):
                        time.sleep(0.05 * (a + 1))
                        try:
                            AutoPoolAccount.place_in_five_pool(
                                user,
                                "FIVE_150",
                                amount_5,
                                source_type=src_type,
                                source_id=f"{src_id}|retry{a+1}",
                            )
                            created_counts["FIVE_150"] += 1
                            ok2 = True
                            break
                        except Exception:
                            continue
                    if not ok2:
                        errors += 1
                except Exception:
                    errors += 1

            if idx % 200 == 0:
                self.stdout.write(
                    f"- processed_events={idx} created5={created_counts.get('FIVE_150', 0)} "
                    f"created3={created_counts.get('THREE_150', 0)} errors={errors}"
                )

        # Post summary
        self.stdout.write(self.style.SUCCESS("Rebuild complete"))
        self.stdout.write(f"Created: FIVE_150={created_counts.get('FIVE_150', 0)}, THREE_150={created_counts.get('THREE_150', 0)}")
        if errors:
            self.stdout.write(self.style.WARNING(f"Errors: {errors} (see logs)"))

        # Write post preview
        doc2 = {
            "mode": "apply",
            "pools": pools,
            "create_counts": created_counts,
            "errors": errors,
        }
        try:
            with open(post_path, "w", encoding="utf-8") as f:
                json.dump(doc2, f, ensure_ascii=False, indent=2, default=str)
        except Exception:
            pass

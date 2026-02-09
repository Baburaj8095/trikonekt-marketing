from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Tuple, Optional
import json
import os
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q, Min

from accounts.models import CustomUser
from business.models import AutoPoolAccount, CommissionConfig, SubscriptionActivation, PromoPurchase, Promo759Subscription, is_matrix_eligible


class Command(BaseCommand):
    help = (
        "Rebuild 5× and 3× matrix placements from PRIME events: ALL PRIME150/PRIME750 purchases and FIRST-TIME PRIME759 activation (monthly).\n"
        "- For each user, collect ALL timestamps for PRIME150/PRIME750 approvals; for PRIME759 collect only the earliest activation/subscription timestamp.\n"
        "- For 150 and 750: create one entry per APPROVED purchase (multiple seats allowed). For 759: create only ONE entry from the first month (first activation/subscription).\n"
        "- Placement ordering is global by activation timestamp (then user id, then product key 150 < 750 < 759).\n"
        "- FIVE_150 placement is sponsor-anchored BFS (fallback to sentinel), THREE_150 is global BFS from sentinel.\n"
        "- Only ACTIVE entries are considered/created; existing accounts are preserved (no reseating). Missing entries are created.\n"
        "\n"
        "Safety:\n"
        "- Does NOT modify ownership/status/timestamps/commissions of existing accounts.\n"
        "- Creates only missing accounts; idempotent per user per product.\n"
        "\n"
        "Usage:\n"
        "  python manage.py rebuild_prime_matrices --dry-run\n"
        "  python manage.py rebuild_prime_matrices --pools=FIVE_150,THREE_150\n"
        "Options:\n"
        "  --dry-run                  Preview without writes\n"
        "  --pools=FIVE_150,THREE_150 Which pools to (back)fill. Defaults to both.\n"
        "  --limit=N                  Optional cap on number of missing placements to attempt (globally) per pool\n"
        "  --start-after-user-id=ID   Skip users with id <= ID (for chunked runs)\n"
        )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Preview actions without DB writes.")
        parser.add_argument(
            "--pools",
            type=str,
            default="FIVE_150,THREE_150",
            help="Comma-separated pools: FIVE_150,THREE_150 (default both).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Optional cap on number of missing placements to process per pool (0 = no cap).",
        )
        parser.add_argument(
            "--start-after-user-id",
            type=int,
            default=0,
            help="Skip users with id <= value (useful for chunked reruns).",
        )
        parser.add_argument(
            "--out",
            type=str,
            default="",
            help="Write preview JSON to this path when --dry-run; defaults to backend/logs/rebuild_mx_preview.json",
        )
        parser.add_argument(
            "--reset-close-existing",
            action="store_true",
            help="Destructive mode: close all existing ACTIVE non-sentinel entries in selected pools before rebuild.",
        )
        parser.add_argument(
            "--only-user-ids",
            type=str,
            default="",
            help="Optional CSV of user IDs to limit scope (applies to close and create). Example: 136,101,125",
        )
        parser.add_argument(
            "--reset-delete-existing",
            action="store_true",
            help="Hard reset: DELETE all non-sentinel entries in selected pools before rebuild (use with caution).",
        )

    # -----------------------
    # Data collection helpers
    # -----------------------
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
        if 32 not in ids:
            ids.append(32)
        return ids

    def _eligible_users_queryset(self, start_after_user_id: int = 0):
        base = CustomUser.objects.filter(category="consumer", is_staff=False, is_superuser=False)
        roots = self._root_user_ids()
        if start_after_user_id > 0:
            base = base.filter(id__gt=start_after_user_id)
        return base.order_by("id").only("id", "username", "date_joined", "first_purchase_activated_at")

    def _first_ts_150(self, user: CustomUser) -> Optional[datetime]:
        # Determine first-time 150 strictly from PRIME150 approvals and 150 activations, not from generic first_purchase_activated_at
        try:
            ts_list = self._all_ts_150(user)
            if ts_list:
                return ts_list[0]
        except Exception:
            pass
        return None

    # New helper to collect ALL 150 activation timestamps (PromoPurchase APPROVED + SubscriptionActivation)
    def _all_ts_150(self, user: CustomUser) -> List[datetime]:
        ts_list: List[datetime] = []
        try:
            # PromoPurchase (PRIME150) approvals
            rows = (
                PromoPurchase.objects.filter(user=user, package__code__iexact="PRIME150", status="APPROVED")
                .order_by("approved_at", "requested_at", "id")
                .values_list("approved_at", "requested_at")
            )
            for a, r in rows:
                if a:
                    ts_list.append(a)
                elif r:
                    ts_list.append(r)
        except Exception:
            pass
        try:
            # SubscriptionActivation for PRIME_150_* and PRODUCT_PRIME (include legacy marker)
            act_rows = (
                SubscriptionActivation.objects.filter(
                    user=user,
                    package__in=("PRIME_150_ACTIVE", "PRIME_150_REDEEM", "PRODUCT_PRIME"),
                )
                .order_by("created_at")
                .values_list("created_at", flat=True)
            )
            for t in act_rows:
                if t:
                    ts_list.append(t)
        except Exception:
            pass
        # Deduplicate and sort
        seen = set()
        uniq: List[datetime] = []
        for t in ts_list:
            key = getattr(t, "isoformat", lambda: str(t))()
            if key not in seen:
                seen.add(key)
                uniq.append(t)
        uniq.sort()
        return uniq

    # New helper to collect ALL 750 approval timestamps (PromoPurchase APPROVED)
    def _all_ts_750(self, user: CustomUser) -> List[datetime]:
        out: List[datetime] = []
        try:
            rows = (
                PromoPurchase.objects.filter(user=user, package__code__iexact="PRIME750", status="APPROVED")
                .order_by("approved_at", "requested_at", "id")
                .values_list("approved_at", "requested_at")
            )
            for a, r in rows:
                if a:
                    out.append(a)
                elif r:
                    out.append(r)
        except Exception:
            pass
        return out

    def _first_ts_750(self, user: CustomUser) -> Optional[datetime]:
        # First approved PRIME750 PromoPurchase (approved_at preferred)
        try:
            row = (
                PromoPurchase.objects.filter(user=user, package__code__iexact="PRIME750", status="APPROVED")
                .order_by("approved_at", "requested_at", "id")
                .values_list("approved_at", "requested_at")
                .first()
            )
            if row:
                a, r = row
                return a or r
        except Exception:
            pass
        return None

    def _first_ts_759(self, user: CustomUser) -> Optional[datetime]:
        # Prefer Promo759Subscription.active_from; fallback to earliest approved PRIME759 or MONTHLY759 PromoPurchase (first month only)
        try:
            sub = (
                Promo759Subscription.objects.filter(user=user)
                .order_by("active_from", "id")
                .values_list("active_from", flat=True)
                .first()
            )
            if sub:
                return sub
        except Exception:
            pass
        try:
            row = (
                PromoPurchase.objects.filter(user=user, status="APPROVED")
                .filter(Q(package__code__iexact="PRIME759") | Q(package__code__iexact="MONTHLY759"))
                .order_by("approved_at", "requested_at", "id")
                .values_list("approved_at", "requested_at")
                .first()
            )
            if row:
                a, r = row
                return a or r
        except Exception:
            pass
        return None

    def _product_events_for_user(self, user: CustomUser) -> List[Tuple[datetime, str]]:
        """
        Return list of (timestamp, product_key) events used to seat matrices:
        - '150': ALL PRIME150 approvals and 150 activations (deduped by timestamp)
        - '750': ALL PRIME750 approvals (each purchase seats)
        - '759': ONLY the first-month approval/subscription (first activation)
        """
        out: List[Tuple[datetime, str]] = []
        # 150: include ALL candidate timestamps
        try:
            for t in self._all_ts_150(user):
                if t:
                    out.append((t, "150"))
        except Exception:
            pass
        # 750: include ALL approved purchase timestamps
        try:
            for t in self._all_ts_750(user):
                if t:
                    out.append((t, "750"))
        except Exception:
            pass
        # 759: only earliest month
        try:
            t759 = self._first_ts_759(user)
            if t759:
                out.append((t759, "759"))
        except Exception:
            pass
        out.sort(key=lambda x: (x[0], x[1]))
        return out

    def _desired_count_per_pool(self, events: List[Tuple[datetime, str]]) -> int:
        # One entry per first-time product key present (max 3)
        return len(events)

    def _existing_count(self, user: CustomUser, pool: str) -> int:
        try:
            return AutoPoolAccount.objects.filter(owner=user, pool_type=pool, status="ACTIVE").count()
        except Exception:
            return 0

    def _base_amount_for_product(self, cfg: CommissionConfig, product_key: str) -> Decimal:
        """
        Choose entry_amount to stamp on AutoPoolAccount for traceability:
        - '150' -> cfg.prime_activation_amount or 150
        - '750' -> cfg.prime_activation_amount (150) [750 splits into units; structural entry treats as 150]
        - '759' -> monthly_759.base_amount if present else 759.00 (fallback to 150 if errors)
        """
        from decimal import Decimal as D
        if product_key == "150":
            try:
                return D(str(cfg.prime_activation_amount or "150.00"))
            except Exception:
                return D("150.00")
        if product_key == "750":
            try:
                return D(str(cfg.prime_activation_amount or "150.00"))
            except Exception:
                return D("150.00")
        if product_key == "759":
            try:
                master = dict(getattr(cfg, "master_commission_json", {}) or {})
                monthly = dict(master.get("monthly_759", {}) or {})
                base = monthly.get("base_amount", 759)
                return D(str(base or "759.00"))
            except Exception:
                try:
                    return D("759.00")
                except Exception:
                    return D("150.00")
        # default
        try:
            return D(str(cfg.prime_activation_amount or "150.00"))
        except Exception:
            return D("150.00")

    # -----------------------
    # Placement helpers
    # -----------------------
    def _place_three(self, user: CustomUser, amount: Decimal, ts: datetime, product_key: str) -> bool:
        # THREE_150 global BFS (ignore sponsor)
        for attempt in range(3):
            try:
                AutoPoolAccount.place_in_three_pool(
                    user,
                    "THREE_150",
                    amount,
                    source_type=f"BACKFILL_{product_key}",
                    source_id=f"user:{getattr(user, 'id', None)}|ts:{ts.isoformat()}|prod:{product_key}",
                )
                return True
            except Exception:
                # include NoCapacityError, MaxDepthError, generic races
                continue
        return False

    def _place_five(self, user: CustomUser, amount: Decimal, ts: datetime, product_key: str) -> bool:
        # FIVE_150 sponsor-anchored BFS
        for attempt in range(3):
            try:
                AutoPoolAccount.place_in_five_pool(
                    user,
                    "FIVE_150",
                    amount,
                    source_type=f"BACKFILL_{product_key}",
                    source_id=f"user:{getattr(user, 'id', None)}|ts:{ts.isoformat()}|prod:{product_key}",
                )
                return True
            except Exception:
                continue
        return False

    # -----------------------
    # Main
    # -----------------------
    def handle(self, *args, **options):
        dry = bool(options.get("dry_run"))
        pools_opt = str(options.get("pools") or "FIVE_150,THREE_150").upper().replace(" ", "")
        pools = [p for p in pools_opt.split(",") if p in ("FIVE_150", "THREE_150")]
        limit = int(options.get("limit") or 0)
        start_after_user_id = int(options.get("start_after_user_id") or 0)
        reset_close = bool(options.get("reset_close_existing"))
        reset_delete = bool(options.get("reset_delete_existing"))
        only_user_ids_str = str(options.get("only_user_ids") or "").strip()
        include_ids: set[int] = set()
        if only_user_ids_str:
            try:
                for tok in only_user_ids_str.split(","):
                    tok = tok.strip()
                    if tok:
                        include_ids.add(int(tok))
            except Exception:
                include_ids = set()

        if not pools:
            self.stdout.write(self.style.ERROR("No valid pools selected. Choose from FIVE_150,THREE_150"))
            return

        cfg = CommissionConfig.get_solo()
        # Ensure sentinels present for BFS roots
        try:
            from business.services.placement import _ensure_sentinel_root
            for p in pools:
                _ensure_sentinel_root(p)
        except Exception:
            pass

        qs = self._eligible_users_queryset(start_after_user_id=start_after_user_id)
        if include_ids:
            qs = qs.filter(id__in=list(include_ids))
        users = list(qs)
        self.stdout.write(self.style.NOTICE(f"Scanning users: {len(users)}, pools={pools}, dry_run={dry}, reset_close={reset_close}, reset_delete={reset_delete}, only_ids={sorted(list(include_ids)) if include_ids else []}"))

        # Determine accounts to close if reset_close is enabled (exclude sentinel roots)
        to_close: Dict[str, List[Tuple[int, int]]] = {}
        if reset_close:
            try:
                for p in pools:
                    qbase = AutoPoolAccount.objects.filter(pool_type=p).exclude(parent_account__isnull=True)
                    if not reset_delete:
                        qbase = qbase.filter(status="ACTIVE")
                    if include_ids:
                        qbase = qbase.filter(owner_id__in=list(include_ids))
                    rows = list(
                        qbase
                        .values_list("id", "owner_id")
                        .order_by("id")
                    )
                    to_close[p] = [(int(aid), int(oid)) for (aid, oid) in rows]
            except Exception:
                to_close = {p: [] for p in pools}
        else:
            to_close = {p: [] for p in pools}

        # Collect per-user product events and compute missing placements per pool
        prod_order = {"150": 0, "750": 1, "759": 2}

        # Build global missing-placements list per pool: [(ts, user_id, product_key)]
        missing: Dict[str, List[Tuple[datetime, int, str]]] = {"FIVE_150": [], "THREE_150": []}

        for u in users:
            if not is_matrix_eligible(u):
                continue
            events = self._product_events_for_user(u)
            if not events:
                continue
            desired = self._desired_count_per_pool(events)

            # Existing counts
            exists5 = self._existing_count(u, "FIVE_150") if "FIVE_150" in pools else 0
            exists3 = self._existing_count(u, "THREE_150") if "THREE_150" in pools else 0

            # Determine which events remain to be placed for each pool
            if reset_close:
                # Full rebuild: plan creation for all first-time events
                if "FIVE_150" in pools:
                    for ts, pk in events:
                        missing["FIVE_150"].append((ts, int(getattr(u, "id", 0) or 0), pk))
                if "THREE_150" in pools:
                    for ts, pk in events:
                        missing["THREE_150"].append((ts, int(getattr(u, "id", 0) or 0), pk))
            else:
                # Incremental backfill: only missing entries per pool
                if "FIVE_150" in pools:
                    need5 = max(0, desired - exists5)
                    if need5 > 0:
                        for ts, pk in events[:need5]:
                            missing["FIVE_150"].append((ts, int(getattr(u, "id", 0) or 0), pk))
                if "THREE_150" in pools:
                    need3 = max(0, desired - exists3)
                    if need3 > 0:
                        for ts, pk in events[:need3]:
                            missing["THREE_150"].append((ts, int(getattr(u, "id", 0) or 0), pk))

        # Sort global queues by ts, then user id, then product order
        for pool in list(missing.keys()):
            arr = missing[pool]
            arr.sort(key=lambda x: (x[0], x[1], prod_order.get(x[2], 99)))
            if limit and limit > 0:
                missing[pool] = arr[:limit]

        # Summary preview
        self.stdout.write(self.style.NOTICE("Summary (missing placements to create):"))
        for pool in pools:
            arr = missing.get(pool) or []
            self.stdout.write(f"  {pool}: {len(arr)} to create")

        if dry:
            # Print a brief preview of the first few rows for each pool
            for pool in pools:
                arr = missing.get(pool) or []
                self.stdout.write(self.style.HTTP_INFO(f"Preview first 10 planned placements for {pool}:"))
                for row in arr[:10]:
                    ts, uid, pk = row
                    self.stdout.write(f"    ts={ts}  user_id={uid}  product={pk}")

            # Also, show close plan if reset_close
            if reset_close:
                for p in pools:
                    if reset_delete:
                        self.stdout.write(self.style.WARNING(f"Would DELETE entries in {p} (non-sentinel): {len((to_close or {}).get(p, []))}"))
                    else:
                        self.stdout.write(self.style.WARNING(f"Would CLOSE ACTIVE entries in {p} (non-sentinel): {len((to_close or {}).get(p, []))}"))

            # Additionally, write a JSON preview for external inspection
            out_path_opt = str(options.get("out") or "").strip()
            try:
                if out_path_opt:
                    out_path = Path(out_path_opt)
                    out_dir = out_path.parent
                else:
                    # Default: backend/logs/rebuild_mx_preview.json (relative to backend/)
                    # Try to locate 'backend' directory upwards from this file
                    base_dir = None
                    for p in Path(__file__).resolve().parents:
                        if p.name == "backend":
                            base_dir = p
                            break
                    if base_dir is None:
                        base_dir = Path.cwd()
                    out_dir = base_dir / "logs"
                    out_dir.mkdir(parents=True, exist_ok=True)
                    out_path = out_dir / "rebuild_mx_preview.json"
                out_dir.mkdir(parents=True, exist_ok=True)
                preview = {
                    "pools": pools,
                    "reset_close": bool(reset_close),
                    "close_totals": {pool: len((to_close or {}).get(pool, [])) for pool in pools},
                    "close_samples": {
                        pool: [
                            {"account_id": int(aid), "owner_id": int(oid)}
                            for (aid, oid) in ((to_close or {}).get(pool, []))[:50]
                        ]
                        for pool in pools
                    },
                    "totals": {pool: len(missing.get(pool) or []) for pool in pools},
                    "create_totals": {pool: len(missing.get(pool) or []) for pool in pools},
                    "samples": {
                        pool: [
                            {
                                "ts": (row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0])),
                                "user_id": int(row[1]),
                                "product": str(row[2]),
                            }
                            for row in (missing.get(pool) or [])[:50]
                        ]
                        for pool in pools
                    },
                }
                with open(out_path, "w", encoding="utf-8") as f:
                    json.dump(preview, f, ensure_ascii=False, indent=2, default=str)
                self.stdout.write(self.style.HTTP_INFO(f"Wrote preview JSON -> {out_path}"))
            except Exception:
                # best-effort logging only; ignore failures
                pass

            self.stdout.write(self.style.SUCCESS("Dry-run complete. No changes applied."))
            return

        # Apply placements
        created_counts = {"FIVE_150": 0, "THREE_150": 0}
        closed_counts = {"FIVE_150": 0, "THREE_150": 0}
        errors = 0

        if reset_close:
            # Close or delete all existing non-sentinel accounts in selected pools
            try:
                for p in pools:
                    ids_to_close = [aid for (aid, _oid) in (to_close.get(p) or [])]
                    if ids_to_close:
                        if reset_delete:
                            n = AutoPoolAccount.objects.filter(id__in=ids_to_close).delete()[0]
                            closed_counts[p] = int(n or 0)
                            self.stdout.write(self.style.WARNING(f"Deleted {closed_counts[p]} non-sentinel entries in {p}."))
                        else:
                            n = AutoPoolAccount.objects.filter(id__in=ids_to_close, status="ACTIVE").update(status="CLOSED")
                            closed_counts[p] = int(n or 0)
                            self.stdout.write(self.style.WARNING(f"Closed {closed_counts[p]} ACTIVE entries in {p} (non-sentinel)."))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Failed closing/deleting existing entries: {e}"))

        # Map for quick user retrieval
        user_by_id: Dict[int, CustomUser] = {int(getattr(u, "id", 0) or 0): u for u in users}

        for pool in pools:
            arr = missing.get(pool) or []
            self.stdout.write(self.style.NOTICE(f"Applying {pool}: planned={len(arr)}"))
            for idx, (ts, uid, pk) in enumerate(arr, start=1):
                user = user_by_id.get(int(uid))
                if not user:
                    continue
                amt = self._base_amount_for_product(cfg, pk)
                ok = False
                try:
                    if pool == "FIVE_150":
                        ok = self._place_five(user, amt, ts, pk)
                    else:
                        ok = self._place_three(user, amt, ts, pk)
                except Exception:
                    ok = False
                if ok:
                    created_counts[pool] = created_counts.get(pool, 0) + 1
                else:
                    errors += 1
                if idx % 100 == 0:
                    self.stdout.write(f"  - {pool}: processed={idx}, created={created_counts.get(pool, 0)}, errors={errors}")

        self.stdout.write(self.style.SUCCESS("Rebuild complete"))
        for pool in pools:
            if reset_close:
                if reset_delete:
                    self.stdout.write(f"Deleted {pool}: {closed_counts.get(pool, 0)}")
                else:
                    self.stdout.write(f"Closed  {pool}: {closed_counts.get(pool, 0)}")
            self.stdout.write(f"Created {pool}: {created_counts.get(pool, 0)}")
        if errors:
            self.stdout.write(self.style.WARNING(f"Errors encountered: {errors} (see logs if any)"))

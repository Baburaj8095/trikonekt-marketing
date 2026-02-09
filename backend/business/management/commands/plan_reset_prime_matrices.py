from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Tuple, Optional
import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db.models import Q

from accounts.models import CustomUser
from business.models import AutoPoolAccount, SubscriptionActivation, PromoPurchase, Promo759Subscription, is_matrix_eligible


class Command(BaseCommand):
    help = (
        "Dry-plan a DESTRUCTIVE reset for FIVE_150 and THREE_150:\n"
        "- Lists ACTIVE non-sentinel accounts that would be CLOSED per pool (to_close)\n"
        "- Lists entries that would be CREATED from first-time activations (150/750/759 earliest only) per pool (to_create)\n"
        "- Output written to JSON (--out or backend/logs/plan_reset_mx.json)"
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--pools",
            type=str,
            default="FIVE_150,THREE_150",
            help="Comma-separated pools: FIVE_150,THREE_150 (default both)",
        )
        parser.add_argument(
            "--start-after-user-id",
            type=int,
            default=0,
            help="Skip users with id <= value (chunked runs)",
        )
        parser.add_argument(
            "--out",
            type=str,
            default="",
            help="Write JSON to this path (default backend/logs/plan_reset_mx.json)",
        )

    # -----------------------
    # Helpers (mirrors rebuild command first-time logic)
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
        return base.exclude(id__in=roots).order_by("id").only("id", "username", "date_joined", "first_purchase_activated_at")

    def _first_ts_150(self, user: CustomUser) -> Optional[datetime]:
        ts = getattr(user, "first_purchase_activated_at", None)
        if ts:
            return ts
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
        return None

    def _first_ts_750(self, user: CustomUser) -> Optional[datetime]:
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
                PromoPurchase.objects.filter(user=user, package__code__iexact="PRIME759", status="APPROVED")
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
        out: List[Tuple[datetime, str]] = []
        try:
            t150 = self._first_ts_150(user)
            if t150:
                out.append((t150, "150"))
        except Exception:
            pass
        try:
            t750 = self._first_ts_750(user)
            if t750:
                out.append((t750, "750"))
        except Exception:
            pass
        try:
            t759 = self._first_ts_759(user)
            if t759:
                out.append((t759, "759"))
        except Exception:
            pass
        out.sort(key=lambda x: (x[0], x[1]))
        return out

    # -----------------------
    # Main
    # -----------------------
    def handle(self, *args, **options):
        pools_opt = str(options.get("pools") or "FIVE_150,THREE_150").upper().replace(" ", "")
        pools = [p for p in pools_opt.split(",") if p in ("FIVE_150", "THREE_150")]
        start_after_user_id = int(options.get("start_after_user_id") or 0)
        out_opt = str(options.get("out") or "").strip()

        if not pools:
            self.stdout.write(self.style.ERROR("No valid pools selected. Choose from FIVE_150,THREE_150"))
            return

        # Determine output path under backend/logs by default
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
            out_path = Path(out_opt) if out_opt else (logs_dir / "plan_reset_mx.json")
        except Exception:
            out_path = Path("plan_reset_mx.json")

        # 1) What would be CLOSED (ACTIVE non-sentinel entries)
        to_close: Dict[str, List[Tuple[int, int]]] = {p: [] for p in pools}
        try:
            for p in pools:
                rows = (
                    AutoPoolAccount.objects
                    .filter(pool_type=p, status="ACTIVE")
                    .exclude(parent_account__isnull=True)
                    .values_list("id", "owner_id")
                    .order_by("id")
                )
                to_close[p] = [(int(aid), int(oid)) for (aid, oid) in rows]
        except Exception:
            pass

        # 2) What would be CREATED (first-time events per user per product)
        qs = self._eligible_users_queryset(start_after_user_id=start_after_user_id)
        users = list(qs)
        prod_order = {"150": 0, "750": 1, "759": 2}
        to_create: Dict[str, List[Tuple[datetime, int, str]]] = {p: [] for p in pools}

        for u in users:
            if not is_matrix_eligible(u):
                continue
            events = self._product_events_for_user(u)
            if not events:
                continue
            for p in pools:
                # For reset, seat all first-time events in each selected pool
                for ts, pk in events:
                    to_create[p].append((ts, int(getattr(u, "id", 0) or 0), pk))

        for p in pools:
            to_create[p].sort(key=lambda x: (x[0], x[1], prod_order.get(x[2], 99)))

        # Build JSON
        doc = {
            "pools": pools,
            "close_totals": {p: len(to_close.get(p) or []) for p in pools},
            "close_samples": {
                p: [{"account_id": aid, "owner_id": oid} for (aid, oid) in (to_close.get(p) or [])[:100]]
                for p in pools
            },
            "create_totals": {p: len(to_create.get(p) or []) for p in pools},
            "create_samples": {
                p: [
                    {
                        "ts": (row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0])),
                        "user_id": int(row[1]),
                        "product": str(row[2]),
                    }
                    for row in (to_create.get(p) or [])[:100]
                ]
                for p in pools
            },
        }

        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2, default=str)
            self.stdout.write(self.style.HTTP_INFO(f"Wrote plan JSON -> {out_path}"))
        except Exception:
            self.stdout.write(self.style.WARNING("Failed to write plan JSON."))

        # Console summary
        self.stdout.write("Plan (DESTRUCTIVE) summary:")
        for p in pools:
            self.stdout.write(f"  {p}: close={doc['close_totals'][p]} create={doc['create_totals'][p]}")

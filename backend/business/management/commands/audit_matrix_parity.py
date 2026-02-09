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
        "Audit parity between THREE_150 and FIVE_150 matrix counts per user vs activation events.\n"
        "- Events definition (FIRST-TIME per product):\n"
        "  * 150: first-time only (earliest of PromoPurchase APPROVED or SubscriptionActivation PRIME_150_*/PRODUCT_PRIME)\n"
        "  * 750: first-time only (earliest APPROVED PromoPurchase)\n"
        "  * 759: first-time only (earliest subscription/approval month)\n"
        "- Expected count per pool = count of distinct first-time events across {150, 750, 759} (max 3)\n"
        "- Report users where FIVE_150 != THREE_150 or either != expected\n"
        "Writes JSON to --out and prints a short summary."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--start-after-user-id",
            type=int,
            default=0,
            help="Skip users with id <= value (chunked runs).",
        )
        parser.add_argument(
            "--out",
            type=str,
            default="",
            help="Write audit JSON to path (default backend/logs/audit_matrix_parity.json).",
        )

    # -----------------------
    # Helpers
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

    def _qs_users(self, start_after_user_id: int = 0):
        roots = self._root_user_ids()
        qs = CustomUser.objects.filter(category="consumer", is_staff=False, is_superuser=False).exclude(id__in=roots)
        if start_after_user_id > 0:
            qs = qs.filter(id__gt=start_after_user_id)
        return qs.order_by("id").only("id", "username", "date_joined")

    def _all_ts_150(self, user: CustomUser) -> List[datetime]:
        ts_list: List[datetime] = []
        # PromoPurchase PRIME150 approvals
        try:
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
        # SubscriptionActivation PRIME_150_* / PRODUCT_PRIME
        try:
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
        # dedupe+sort
        seen = set()
        uniq: List[datetime] = []
        for t in ts_list:
            key = getattr(t, "isoformat", lambda: str(t))()
            if key not in seen:
                seen.add(key)
                uniq.append(t)
        uniq.sort()
        return uniq

    def _all_ts_750(self, user: CustomUser) -> List[datetime]:
        out: List[datetime] = []
        try:
            rows = (
                PromoPurchase.objects.filter(user=user, package__code__iexact="PRIME750", status="APPROVED")
                .order_by("approved_at", "requested_at", "id")
                .values_list("approved_at", "requested_at")
            )
            for a, r in rows:
                out.append(a or r)
        except Exception:
            pass
        return [t for t in out if t]

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

    def _expected_events_count(self, user: CustomUser) -> int:
        try:
            if not is_matrix_eligible(user):
                return 0
        except Exception:
            return 0
        # FIRST-TIME ONLY per product
        has150 = 1 if self._all_ts_150(user) else 0
        has750 = 1 if self._all_ts_750(user) else 0
        has759 = 1 if self._first_ts_759(user) else 0
        return int(has150 + has750 + has759)

    def _count_active(self, user: CustomUser, pool: str) -> int:
        try:
            return AutoPoolAccount.objects.filter(owner=user, pool_type=pool, status="ACTIVE").count()
        except Exception:
            return 0

    # -----------------------
    # Main
    # -----------------------
    def handle(self, *args, **options):
        start_after_user_id = int(options.get("start_after_user_id") or 0)
        out_path_opt = str(options.get("out") or "").strip()

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
            out_path = Path(out_path_opt) if out_path_opt else (logs_dir / "audit_matrix_parity.json")
        except Exception:
            out_path = Path("audit_matrix_parity.json")

        users = list(self._qs_users(start_after_user_id=start_after_user_id))
        report: Dict[str, object] = {
            "scanned_users": len(users),
            "mismatches": [],
            "totals": {"parity_ok": 0, "five_miss": 0, "three_miss": 0, "overage": 0, "any_mismatch": 0},
            "samples": {"first_20": []},
        }

        parity_ok = 0
        five_miss = 0
        three_miss = 0
        overage = 0
        any_mismatch = 0

        for u in users:
            exp = self._expected_events_count(u)
            if exp <= 0:
                continue
            c5 = self._count_active(u, "FIVE_150")
            c3 = self._count_active(u, "THREE_150")
            mismatch = (c5 != c3) or (c5 != exp) or (c3 != exp)
            if mismatch:
                any_mismatch += 1
                five_def = exp - c5
                three_def = exp - c3
                if five_def > 0:
                    five_miss += 1
                if three_def > 0:
                    three_miss += 1
                if c5 > exp or c3 > exp:
                    overage += 1
                rec = {
                    "user_id": int(getattr(u, "id", 0) or 0),
                    "username": getattr(u, "username", None),
                    "expected": int(exp),
                    "five": int(c5),
                    "three": int(c3),
                    "five_deficit": int(five_def),
                    "three_deficit": int(three_def),
                }
                if len(report["samples"]["first_20"]) < 20:
                    report["samples"]["first_20"].append(rec)
                report["mismatches"].append(rec)
            else:
                parity_ok += 1

        report["totals"] = {
            "parity_ok": int(parity_ok),
            "five_miss": int(five_miss),
            "three_miss": int(three_miss),
            "overage": int(overage),
            "any_mismatch": int(any_mismatch),
        }

        try:
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2, default=str)
            self.stdout.write(self.style.HTTP_INFO(f"Wrote audit JSON -> {out_path}"))
        except Exception:
            self.stdout.write(self.style.WARNING("Failed to write audit JSON."))

        # Console summary
        self.stdout.write("Scanned users: {}".format(len(users)))
        self.stdout.write("Parity OK: {}".format(parity_ok))
        self.stdout.write("Users with FIVE_150 deficit: {}".format(five_miss))
        self.stdout.write("Users with THREE_150 deficit: {}".format(three_miss))
        self.stdout.write("Users with overage (either pool > expected): {}".format(overage))
        self.stdout.write("Any mismatch total: {}".format(any_mismatch))

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple, List

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from accounts.models import CustomUser, WalletTransaction
from business.models import AutoPoolAccount, CommissionConfig
from business.services import prime as prime_svc


@dataclass(frozen=True)
class _SeatRef:
    pool_type: str
    seat: AutoPoolAccount


class Command(BaseCommand):
    help = (
        "Simulate N downline users purchasing Prime (150/750) and trigger 5 & 3 matrix payouts, "
        "attributing earnings to the upline seat IDs via WalletTransaction.matrix_account.\n\n"
        "This is a QA/debug tool: it creates new consumer users, places their matrix entries under the given "
        "upline seat(s), then credits matrix uplines using the same config-driven fixed/percent logic as the "
        "Prime engines.\n\n"
        "Examples:\n"
        "  python manage.py simulate_downline_prime_payout --upline-five-seat 10295 --count 2 --product 750\n"
        "  python manage.py simulate_downline_prime_payout --upline-five-key 8095918105-4 --count 2 --product 750\n"
        "  python manage.py simulate_downline_prime_payout --upline-five-seat 10295 --upline-three-seat 10296 --count 3 --product 150\n"
    )

    def add_arguments(self, parser):
        group5 = parser.add_mutually_exclusive_group(required=True)
        group5.add_argument("--upline-five-seat", help="AutoPoolAccount id (FIVE_150) to anchor placements")
        group5.add_argument("--upline-five-key", help="AutoPoolAccount.username_key (FIVE_150) to anchor placements")

        group3 = parser.add_mutually_exclusive_group(required=False)
        group3.add_argument("--upline-three-seat", help="Optional AutoPoolAccount id (THREE_150) to anchor placements")
        group3.add_argument("--upline-three-key", help="Optional AutoPoolAccount.username_key (THREE_150) to anchor placements")

        parser.add_argument("--product", type=str, default="750", help="Prime product key: 150 or 750")
        parser.add_argument("--count", type=int, default=2, help="Number of downline users to create")
        parser.add_argument("--username-prefix", type=str, default="SIMDN", help="Prefix for new simulated downline usernames")
        parser.add_argument("--password", type=str, default="Pass@1234", help="Password for new simulated users")
        parser.add_argument("--source-type", type=str, default="SIM_PRIME", help="WalletTransaction.source_type marker")
        parser.add_argument("--dry-run", action="store_true", help="If set, prints actions without writing")

    def _resolve_seat_by_id(self, seat_id: str, pool_type: str) -> _SeatRef:
        if not str(seat_id or "").isdigit():
            raise CommandError(f"Invalid seat id '{seat_id}'")
        seat = AutoPoolAccount.objects.filter(id=int(seat_id), pool_type=pool_type).select_related("owner").first()
        if not seat:
            raise CommandError(f"Seat #{seat_id} not found for pool_type={pool_type}")
        return _SeatRef(pool_type=pool_type, seat=seat)

    def _resolve_seat_by_key(self, username_key: str, pool_type: str) -> _SeatRef:
        key = str(username_key or "").strip()
        if not key:
            raise CommandError("username_key is empty")
        seat = (
            AutoPoolAccount.objects.filter(username_key=key, pool_type=pool_type, status="ACTIVE")
            .select_related("owner")
            .order_by("-id")
            .first()
        )
        if not seat:
            raise CommandError(f"No ACTIVE seat found for username_key='{key}' pool_type={pool_type}")
        return _SeatRef(pool_type=pool_type, seat=seat)

    def _base_amount_for_product(self, product_key: str) -> Decimal:
        cfg = CommissionConfig.get_solo()
        if str(product_key) == "150":
            return prime_svc._resolve_base_amount(cfg, "150", multiplier=None)
        if str(product_key) == "750":
            try:
                mult = int(getattr(prime_svc.CommissionPolicy.load().prime750(), "multiplier", 0) or 0)
            except Exception:
                mult = 0
            return prime_svc._resolve_base_amount(cfg, "750", multiplier=mult)
        raise CommandError("--product must be 150 or 750")

    def _matrix_amounts_for_product(
        self,
        *,
        cfg: CommissionConfig,
        product_key: str,
        pool_block: Dict[str, Any],
        fallback_multiplier: int,
        fallback_product_key: str,
        legacy_amounts: List[Any],
    ) -> Tuple[List[Decimal], List[Decimal]]:
        """Return (fixed_amounts, percents) for a pool/product, with 750->150 fallback when needed."""
        row = dict(pool_block.get(product_key, {}) or {})
        fixed = list(row.get("fixed_amounts") or legacy_amounts or [])
        perc = list(row.get("percents") or [])

        # 750 fallback: derive fixed from 150 * multiplier when 750 fixed missing
        if str(product_key) == "750" and not fixed:
            try:
                base_row = dict(pool_block.get(fallback_product_key, {}) or {})
                base_fixed = list(base_row.get("fixed_amounts") or legacy_amounts or [])
                if base_fixed:
                    fixed = [Decimal(str(x)) * Decimal(str(fallback_multiplier)) for x in base_fixed]
            except Exception:
                fixed = []
        # Normalize to Decimals
        try:
            fixed_q = [prime_svc._q2(Decimal(str(x))) for x in fixed]
        except Exception:
            fixed_q = []
        try:
            perc_q = [Decimal(str(x)) for x in perc]
        except Exception:
            perc_q = []
        return fixed_q, perc_q

    def _credit_matrix_for_accounts(
        self,
        *,
        consumer: CustomUser,
        created_five: List[AutoPoolAccount],
        created_three: List[AutoPoolAccount],
        product_key: str,
        base_amount: Decimal,
        source_type: str,
        source_id: str,
    ) -> None:
        cfg = CommissionConfig.get_solo()
        master = dict(getattr(cfg, "master_commission_json", {}) or {})
        cm5 = dict(master.get("consumer_matrix_5", {}) or {})
        cm3 = dict(master.get("consumer_matrix_3", {}) or {})

        try:
            mult = int(getattr(prime_svc.CommissionPolicy.load().prime750(), "multiplier", 0) or 0)
        except Exception:
            mult = 5
        if mult <= 0:
            mult = 5

        # Five
        if created_five:
            five_levels = int(cfg.get_matrix_five_levels())
            fixed5, perc5 = self._matrix_amounts_for_product(
                cfg=cfg,
                product_key=product_key,
                pool_block=cm5,
                fallback_multiplier=mult,
                fallback_product_key="150",
                legacy_amounts=list(getattr(cfg, "five_matrix_amounts_json", []) or []),
            )
            if fixed5:
                for acc in created_five:
                    upline_nodes = prime_svc._matrix_ancestor_accounts(acc, depth=five_levels)
                    iterable = [(idx, getattr(node, "owner", None), getattr(node, "id", None)) for idx, node in enumerate(upline_nodes)]
                    for idx, recipient, matrix_account_id in iterable:
                        if idx >= len(fixed5):
                            break
                        amt = prime_svc._q2(fixed5[idx] or 0)
                        if amt <= 0:
                            continue
                        meta = {
                            "source": f"FIVE_MATRIX_{product_key}_FIXED",
                            "source_type": source_type,
                            "source_id": source_id,
                            "level_index": idx + 1,
                            "fixed": True,
                            "trigger": f"PRIME_{product_key}",
                            "from_user_id": getattr(consumer, "id", None),
                            "from_user": getattr(consumer, "username", None),
                        }
                        prime_svc._credit_wallet(
                            recipient,
                            amt,
                            tx_type="AUTOPOOL_BONUS_FIVE",
                            meta=meta,
                            source_type=source_type,
                            source_id=source_id,
                            matrix_account_id=matrix_account_id,
                        )
            else:
                five_percents = prime_svc._as_percents(perc5 or getattr(cfg, "five_matrix_percents_json", []) or [], five_levels)
                for acc in created_five:
                    upline_nodes = prime_svc._matrix_ancestor_accounts(acc, depth=five_levels)
                    iterable = [(idx, getattr(node, "owner", None), getattr(node, "id", None)) for idx, node in enumerate(upline_nodes)]
                    for idx, recipient, matrix_account_id in iterable:
                        if idx >= len(five_percents):
                            break
                        pct = five_percents[idx] or Decimal("0")
                        amt = prime_svc._q2(Decimal(str(base_amount)) * pct / Decimal("100"))
                        if amt <= 0:
                            continue
                        meta = {
                            "source": f"FIVE_MATRIX_{product_key}",
                            "source_type": source_type,
                            "source_id": source_id,
                            "level_index": idx + 1,
                            "percent": str(pct),
                            "trigger": f"PRIME_{product_key}",
                            "from_user_id": getattr(consumer, "id", None),
                            "from_user": getattr(consumer, "username", None),
                        }
                        prime_svc._credit_wallet(
                            recipient,
                            amt,
                            tx_type="AUTOPOOL_BONUS_FIVE",
                            meta=meta,
                            source_type=source_type,
                            source_id=source_id,
                            matrix_account_id=matrix_account_id,
                        )

        # Three
        if created_three:
            three_levels = int(cfg.get_matrix_three_levels())
            fixed3, perc3 = self._matrix_amounts_for_product(
                cfg=cfg,
                product_key=product_key,
                pool_block=cm3,
                fallback_multiplier=mult,
                fallback_product_key="150",
                legacy_amounts=list(getattr(cfg, "three_matrix_amounts_json", []) or []),
            )
            if fixed3:
                for acc in created_three:
                    upline_nodes = prime_svc._matrix_ancestor_accounts(acc, depth=three_levels)
                    iterable = [(idx, getattr(node, "owner", None), getattr(node, "id", None)) for idx, node in enumerate(upline_nodes)]
                    for idx, recipient, matrix_account_id in iterable:
                        if idx >= len(fixed3):
                            break
                        amt = prime_svc._q2(fixed3[idx] or 0)
                        if amt <= 0:
                            continue
                        meta = {
                            "source": f"THREE_MATRIX_{product_key}_FIXED",
                            "source_type": source_type,
                            "source_id": source_id,
                            "level_index": idx + 1,
                            "fixed": True,
                            "trigger": f"PRIME_{product_key}",
                            "from_user_id": getattr(consumer, "id", None),
                            "from_user": getattr(consumer, "username", None),
                        }
                        prime_svc._credit_wallet(
                            recipient,
                            amt,
                            tx_type="AUTOPOOL_BONUS_THREE",
                            meta=meta,
                            source_type=source_type,
                            source_id=source_id,
                            matrix_account_id=matrix_account_id,
                        )
            else:
                three_percents = prime_svc._as_percents(perc3 or getattr(cfg, "three_matrix_percents_json", []) or [], three_levels)
                for acc in created_three:
                    upline_nodes = prime_svc._matrix_ancestor_accounts(acc, depth=three_levels)
                    iterable = [(idx, getattr(node, "owner", None), getattr(node, "id", None)) for idx, node in enumerate(upline_nodes)]
                    for idx, recipient, matrix_account_id in iterable:
                        if idx >= len(three_percents):
                            break
                        pct = three_percents[idx] or Decimal("0")
                        amt = prime_svc._q2(Decimal(str(base_amount)) * pct / Decimal("100"))
                        if amt <= 0:
                            continue
                        meta = {
                            "source": f"THREE_MATRIX_{product_key}",
                            "source_type": source_type,
                            "source_id": source_id,
                            "level_index": idx + 1,
                            "percent": str(pct),
                            "trigger": f"PRIME_{product_key}",
                            "from_user_id": getattr(consumer, "id", None),
                            "from_user": getattr(consumer, "username", None),
                        }
                        prime_svc._credit_wallet(
                            recipient,
                            amt,
                            tx_type="AUTOPOOL_BONUS_THREE",
                            meta=meta,
                            source_type=source_type,
                            source_id=source_id,
                            matrix_account_id=matrix_account_id,
                        )

    def _summarize_upline_earnings(self, *, upline_user_id: int, upline_seat_id: int, orig_type: str, source_type: str, source_ids: List[str]) -> Tuple[Decimal, int]:
        if not source_ids:
            return Decimal("0.00"), 0
        qs = (
            WalletTransaction.objects.filter(user_id=upline_user_id, amount__gt=0)
            .filter(source_type=source_type, source_id__in=source_ids)
            .filter(matrix_account_id=upline_seat_id)
        )
        # Include both legacy orig_type rows and split rows with meta.orig_type
        qs = qs.filter(
            (prime_svc.Q(type=orig_type))
            | (
                prime_svc.Q(type__in=["INCOME_CREDIT_75", "SELF_ACCOUNT_CREDIT"])
                & prime_svc.Q(meta__orig_type=orig_type)
            )
        )
        total = Decimal("0.00")
        count = 0
        for r in qs.values("amount"):
            try:
                total += Decimal(str(r.get("amount") or "0"))
                count += 1
            except Exception:
                continue
        return total, count

    def handle(self, *args, **options):
        product_key = str(options.get("product") or "750").strip()
        count = max(1, int(options.get("count") or 1))
        username_prefix = str(options.get("username_prefix") or "SIMDN").strip() or "SIMDN"
        password = str(options.get("password") or "Pass@1234")
        source_type = str(options.get("source_type") or "SIM_PRIME").strip() or "SIM_PRIME"
        dry_run = bool(options.get("dry_run", False))

        if product_key not in {"150", "750"}:
            raise CommandError("--product must be 150 or 750")

        # Resolve seats
        if options.get("upline_five_seat"):
            five_ref = self._resolve_seat_by_id(options["upline_five_seat"], "FIVE_150")
        else:
            five_ref = self._resolve_seat_by_key(options["upline_five_key"], "FIVE_150")

        three_ref: Optional[_SeatRef] = None
        if options.get("upline_three_seat"):
            three_ref = self._resolve_seat_by_id(options["upline_three_seat"], "THREE_150")
        elif options.get("upline_three_key"):
            three_ref = self._resolve_seat_by_key(options["upline_three_key"], "THREE_150")

        upline_user = getattr(five_ref.seat, "owner", None)
        if not upline_user or not getattr(upline_user, "id", None):
            raise CommandError("Upline FIVE_150 seat has no owner")

        base_amount = self._base_amount_for_product(product_key)
        run_id = timezone.now().strftime("%Y%m%dT%H%M%S")

        self.stdout.write(self.style.MIGRATE_HEADING("Simulating downline Prime matrix payouts"))
        self.stdout.write(f"- Product: PRIME_{product_key}")
        self.stdout.write(f"- Base amount: ₹{base_amount}")
        self.stdout.write(f"- Downline count: {count}")
        self.stdout.write(f"- Source type: {source_type}")
        self.stdout.write(f"- Upline FIVE seat: id={five_ref.seat.id} username_key={five_ref.seat.username_key} owner={upline_user.username} (user_id={upline_user.id})")
        if three_ref:
            self.stdout.write(f"- Upline THREE seat: id={three_ref.seat.id} username_key={three_ref.seat.username_key} owner={three_ref.seat.owner.username} (user_id={three_ref.seat.owner_id})")
        else:
            self.stdout.write("- Upline THREE seat: (not provided) -> THREE_150 placement/payout will be skipped")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: no DB writes"))

        created_users: List[CustomUser] = []
        created_five: List[AutoPoolAccount] = []
        created_three: List[AutoPoolAccount] = []
        source_ids: List[str] = []

        from business.services.placement import GenericPlacement

        ctx = transaction.atomic() if not dry_run else transaction.atomic()
        with ctx:
            for i in range(count):
                source_id = f"{run_id}:{i + 1}"
                source_ids.append(source_id)
                uname = f"{username_prefix}_{upline_user.id}_{run_id}_{i + 1}"

                if CustomUser.objects.filter(username=uname).exists():
                    raise CommandError(f"Username collision: {uname}")

                if not dry_run:
                    user = CustomUser.objects.create_user(
                        username=uname,
                        password=password,
                        role="user",
                        category="consumer",
                        registered_by=upline_user,
                    )
                else:
                    user = CustomUser(username=uname, role="user", category="consumer", registered_by=upline_user)

                created_users.append(user)

                # Place FIVE_150 under specified upline seat
                if not dry_run:
                    acc5 = AutoPoolAccount.create_five_150_for_user(
                        user,
                        amount=base_amount,
                        source_type=source_type,
                        source_id=source_id,
                        start_entry_id=int(five_ref.seat.id),
                        max_allowed=1,
                    )
                else:
                    acc5 = None

                if acc5:
                    created_five.append(acc5)

                # Place THREE_150 under specified upline seat (optional)
                acc3 = None
                if three_ref and not dry_run:
                    acc3 = GenericPlacement.place_account(
                        owner=user,
                        pool_type="THREE_150",
                        amount=Decimal(str(base_amount)),
                        source_type=source_type,
                        source_id=source_id,
                        start_entry_id=int(three_ref.seat.id),
                    )
                    if acc3:
                        created_three.append(acc3)

                # Trigger matrix payouts for this simulated purchase
                if not dry_run:
                    self._credit_matrix_for_accounts(
                        consumer=user,
                        created_five=[acc5] if acc5 else [],
                        created_three=[acc3] if acc3 else [],
                        product_key=product_key,
                        base_amount=base_amount,
                        source_type=source_type,
                        source_id=source_id,
                    )

            if dry_run:
                transaction.set_rollback(True)

        # Summary for upline
        self.stdout.write(self.style.SUCCESS("\nSimulation complete"))
        self.stdout.write(f"- Downline users created: {len(created_users)}")
        if not dry_run:
            self.stdout.write(f"- FIVE_150 accounts created: {len(created_five)}")
            if three_ref:
                self.stdout.write(f"- THREE_150 accounts created: {len(created_three)}")

            five_total, five_count = self._summarize_upline_earnings(
                upline_user_id=upline_user.id,
                upline_seat_id=five_ref.seat.id,
                orig_type="AUTOPOOL_BONUS_FIVE",
                source_type=source_type,
                source_ids=source_ids,
            )
            self.stdout.write(f"\nUpline FIVE seat earnings (seat_id={five_ref.seat.id}): tx_count={five_count}, total=₹{five_total:.2f}")

            if three_ref and three_ref.seat.owner_id:
                three_total, three_count = self._summarize_upline_earnings(
                    upline_user_id=int(three_ref.seat.owner_id),
                    upline_seat_id=int(three_ref.seat.id),
                    orig_type="AUTOPOOL_BONUS_THREE",
                    source_type=source_type,
                    source_ids=source_ids,
                )
                self.stdout.write(f"Upline THREE seat earnings (seat_id={three_ref.seat.id}): tx_count={three_count}, total=₹{three_total:.2f}")

            # Print per-seat attribution for the upline user, limited to these source_ids
            self.stdout.write("\nPer-seat attributed credits for upline user (debug):")
            qs = (
                WalletTransaction.objects.filter(user_id=upline_user.id, source_type=source_type, source_id__in=source_ids, amount__gt=0)
                .order_by("id")
                .values("id", "type", "amount", "matrix_account_id", "meta", "source_id")
            )
            shown = 0
            for r in qs:
                m = r.get("meta") or {}
                orig = m.get("orig_type")
                if r.get("type") not in {"AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE", "INCOME_CREDIT_75", "SELF_ACCOUNT_CREDIT"}:
                    continue
                if r.get("type") in {"INCOME_CREDIT_75", "SELF_ACCOUNT_CREDIT"} and orig not in {"AUTOPOOL_BONUS_FIVE", "AUTOPOOL_BONUS_THREE"}:
                    continue
                self.stdout.write(
                    f"  - tx#{r['id']} src={r.get('source_id')} type={r.get('type')} orig={orig} amt={Decimal(str(r.get('amount') or '0'))} seat={r.get('matrix_account_id')} lvl={m.get('level_index')}"
                )
                shown += 1
                if shown >= 50:
                    self.stdout.write("  (truncated)")
                    break

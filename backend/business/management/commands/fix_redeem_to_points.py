import json
import os
from decimal import Decimal
from typing import Optional

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.db.models import Q

from accounts.models import CustomUser, Wallet, WalletTransaction, RewardPointsAccount


def _find_user(identifier: str) -> Optional[CustomUser]:
    identifier = str(identifier or "").strip()
    if not identifier:
        return None
    # Try numeric id
    u = None
    if identifier.isdigit():
        u = CustomUser.objects.filter(pk=int(identifier)).first()
        if u:
            return u
    # Try username exact match
    u = CustomUser.objects.filter(username=identifier).first()
    if u:
        return u
    # Try prefixed_id
    u = CustomUser.objects.filter(prefixed_id__iexact=identifier).first()
    if u:
        return u
    # Try sponsor_id
    u = CustomUser.objects.filter(sponsor_id__iexact=identifier).first()
    return u


class Command(BaseCommand):
    help = "Reclassify wallet REDEEM credits into Reward Points. Creates balancing wallet debits and credits points. Outputs a JSON report under backend/logs/."

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="User id, username, prefixed_id or sponsor_id")
        parser.add_argument("--since", help="ISO date YYYY-MM-DD to restrict affected transactions", default=None)
        parser.add_argument("--dry-run", action="store_true", help="Only report, do not modify balances")
        parser.add_argument("--outfile", help="Optional custom output path (relative to backend/)")

    def handle(self, *args, **options):
        ident = options["user"]
        since = options.get("since")
        dry_run = bool(options.get("dry_run"))
        outfile = options.get("outfile")

        u = _find_user(ident)
        if not u:
            raise CommandError(f"User not found for identifier '{ident}'")

        # Target tx types that previously credited money wallet
        target_types = ("REDEEM_PROMO_750", "REDEEM_ECOUPON_CREDIT")

        qs = WalletTransaction.objects.filter(user=u, type__in=target_types, amount__gt=0)
        if since:
            try:
                qs = qs.filter(created_at__date__gte=since)
            except Exception:
                pass

        txs = list(qs.order_by("id"))
        total_amount = sum((t.amount for t in txs), Decimal("0.00"))

        # Gather pre-state
        w = Wallet.get_or_create_for_user(u)
        rpa = RewardPointsAccount.get_or_create_for_user(u)
        pre = {
            "wallet": {
                "balance": str(w.balance),
                "main_balance": str(w.main_balance),
                "withdrawable_balance": str(w.withdrawable_balance),
            },
            "reward_points": {
                "balance_points": str(rpa.balance_points),
            },
        }

        errors = []
        processed = []

        if not dry_run:
            for tx in txs:
                with transaction.atomic():
                    try:
                        # 1) Debit wallet to reverse the previous redeem credit
                        w = Wallet.get_or_create_for_user(u)
                        w.debit(
                            tx.amount,
                            tx_type="ADJUSTMENT_DEBIT",
                            meta={
                                "reason": "reclassify_redeem_to_points",
                                "orig_tx_id": tx.id,
                                "orig_type": tx.type,
                            },
                            source_type=tx.source_type or "REDEEM_FIX",
                            source_id=tx.source_id or str(tx.id),
                        )
                        # 2) Credit reward points for same value
                        RewardPointsAccount.credit_points(
                            u,
                            tx.amount,
                            reason="RECLASSIFY_REDEEM",
                            meta={
                                "from_tx_id": tx.id,
                                "orig_type": tx.type,
                                "source_type": tx.source_type or "REDEEM_FIX",
                                "source_id": tx.source_id or str(tx.id),
                            },
                        )
                        processed.append(tx.id)
                    except Exception as e:
                        errors.append({"tx_id": tx.id, "error": str(e)})

        # Gather post-state
        w.refresh_from_db()
        rpa.refresh_from_db()
        post = {
            "wallet": {
                "balance": str(w.balance),
                "main_balance": str(w.main_balance),
                "withdrawable_balance": str(w.withdrawable_balance),
            },
            "reward_points": {
                "balance_points": str(rpa.balance_points),
            },
        }

        report = {
            "user": {
                "id": u.id,
                "username": u.username,
                "prefixed_id": u.prefixed_id,
                "sponsor_id": u.sponsor_id,
                "category": u.category,
                "role": u.role,
            },
            "params": {"since": since, "dry_run": dry_run},
            "target_types": target_types,
            "affected_count": len(txs),
            "affected_total": str(total_amount),
            "pre_state": pre,
            "post_state": post,
            "processed_tx_ids": processed,
            "errors": errors,
            "sample_transactions": [
                {
                    "id": t.id,
                    "type": t.type,
                    "amount": str(t.amount),
                    "created_at": t.created_at.isoformat(),
                    "source_type": t.source_type,
                    "source_id": t.source_id,
                    "meta": t.meta,
                }
                for t in txs[:50]
            ],
        }

        ts = timezone.now().strftime("%Y%m%d_%H%M%S")
        base_dir = os.getcwd()  # backend/
        logs_dir = os.path.join(base_dir, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        out_name = outfile or f"redeem_fix_{u.username or u.prefixed_id or u.id}_{ts}.json"
        out_path = os.path.join(logs_dir, out_name)

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        self.stdout.write(self.style.SUCCESS(f"Wrote report: {out_path}"))

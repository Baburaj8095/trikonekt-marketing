import json
import os
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from django.db.models import Sum

from accounts.models import CustomUser, Wallet, WalletTransaction, RewardPointsAccount, RewardPointsTransaction
from business.models import SubscriptionActivation, PromoPurchase


def _find_user(identifier: str):
    identifier = str(identifier or "").strip()
    if not identifier:
        return None
    u = None
    if identifier.isdigit():
        u = CustomUser.objects.filter(pk=int(identifier)).first()
        if u:
            return u
    u = CustomUser.objects.filter(username=identifier).first() or u
    u = CustomUser.objects.filter(prefixed_id__iexact=identifier).first() or u
    u = CustomUser.objects.filter(sponsor_id__iexact=identifier).first() or u
    return u


class Command(BaseCommand):
    help = "Dump wallet, reward points, recent transactions, and promo/activation info for a user to backend/logs JSON."

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="User id, username, prefixed_id or sponsor_id")
        parser.add_argument("--outfile", help="Optional custom output filename (json) under backend/logs")

    def handle(self, *args, **opts):
        ident = opts["user"]
        u = _find_user(ident)
        if not u:
            raise CommandError(f"User not found for '{ident}'")

        # Wallet balances
        w = Wallet.get_or_create_for_user(u)
        wallet_info = {
            "balance": str(getattr(w, "balance", None)),
            "main_balance": str(getattr(w, "main_balance", None)),
            "withdrawable_balance": str(getattr(w, "withdrawable_balance", None)),
        }

        # Wallet tx aggregates and last N
        wallet_tx_sums = list(
            WalletTransaction.objects.filter(user=u)
            .values("type")
            .annotate(sum=Sum("amount"))
            .order_by("type")
        )
        wallet_last = [
            {
                "id": t["id"],
                "created_at": str(t["created_at"]),
                "type": t["type"],
                "amount": str(t["amount"]),
                "balance_after": str(t["balance_after"]),
                "meta": t["meta"],
            }
            for t in WalletTransaction.objects.filter(user=u)
            .order_by("-created_at")
            .values("id", "created_at", "type", "amount", "balance_after", "meta")[:100]
        ]

        # Reward points
        rpa = RewardPointsAccount.get_or_create_for_user(u)
        points_info = {"balance_points": str(getattr(rpa, "balance_points", None))}
        points_last = [
            {
                "id": t["id"],
                "created_at": str(t["created_at"]),
                "type": t["type"],
                "points": str(t["points"]),
                "meta": t["meta"],
            }
            for t in RewardPointsTransaction.objects.filter(user=u)
            .order_by("-created_at")
            .values("id", "created_at", "type", "points", "meta")[:100]
        ]

        # Subscription activations
        subs = [
            {
                "package": x["package"],
                "amount": str(x["amount"]),
                "source_type": x["source_type"],
                "source_id": x["source_id"],
                "created_at": str(x["created_at"]),
            }
            for x in SubscriptionActivation.objects.filter(user=u)
            .order_by("-created_at")
            .values("package", "amount", "source_type", "source_id", "created_at")[:50]
        ]

        # Promo purchases
        pp = [
            {
                "id": x["id"],
                "status": x["status"],
                "approved_at": str(x["approved_at"]) if x["approved_at"] else None,
                "requested_at": str(x["requested_at"]),
                "package_type": x["package__type"],
                "package_price": str(x["package__price"]),
                "prime150_choice": x["prime150_choice"],
                "prime750_choice": x["prime750_choice"],
            }
            for x in PromoPurchase.objects.filter(user=u)
            .order_by("-requested_at")
            .values(
                "id",
                "status",
                "approved_at",
                "requested_at",
                "package__type",
                "package__price",
                "prime150_choice",
                "prime750_choice",
            )[:50]
        ]

        out = {
            "user": {
                "id": u.id,
                "username": u.username,
                "prefixed_id": u.prefixed_id,
                "sponsor_id": u.sponsor_id,
                "category": u.category,
                "role": u.role,
                "account_active": bool(getattr(u, "account_active", False)),
            },
            "wallet": wallet_info,
            "wallet_tx_sums": wallet_tx_sums,
            "wallet_last_100": wallet_last,
            "reward_points": points_info,
            "reward_points_last_100": points_last,
            "subscription_activations": subs,
            "promo_purchases": pp,
        }

        logs_dir = os.path.join(settings.BASE_DIR, "logs")
        os.makedirs(logs_dir, exist_ok=True)
        fname = opts["outfile"] or f"dump_user_ledger_{u.username or u.prefixed_id or u.id}.json"
        out_path = os.path.join(logs_dir, fname)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        self.stdout.write(self.style.SUCCESS(f"Wrote {out_path}"))

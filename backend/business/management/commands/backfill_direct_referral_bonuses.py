from django.core.management.base import BaseCommand
from decimal import Decimal
from typing import Optional

from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import CommissionConfig


class Command(BaseCommand):
    help = (
        "Backfill missing DIRECT_REF_BONUS transactions for sponsors based on current registered_by links.\n"
        "This ONLY creates the direct referral bonus for the sponsor when missing, and DOES NOT trigger\n"
        "level bonuses, matrix placements, or any other side effects. Safe to run multiple times."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--sponsor",
            type=str,
            default="",
            help="Optional: restrict backfill to a specific sponsor username (case-insensitive).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not write anything. Only print what would be done.",
        )

    def handle(self, *args, **options):
        sponsor_filter: str = (options.get("sponsor") or "").strip()
        dry_run: bool = bool(options.get("dry_run"))

        cfg = CommissionConfig.get_solo()
        try:
            direct_cfg = getattr(cfg, "referral_join_fixed_json", {}) or {}
            direct_amount = Decimal(str(direct_cfg.get("direct", 15)))
        except Exception:
            direct_amount = Decimal("15.00")

        if direct_amount <= 0:
            self.stdout.write(self.style.WARNING("Configured direct referral amount is 0. Nothing to backfill."))
            return

        qs = CustomUser.objects.exclude(registered_by__isnull=True)
        if sponsor_filter:
            qs = qs.filter(registered_by__username__iexact=sponsor_filter)

        total = 0
        already = 0
        created = 0
        skipped_no_sponsor = 0

        self.stdout.write(f"Scanning {qs.count()} users for missing DIRECT_REF_BONUS backfill (direct={direct_amount})"
                          + (f" for sponsor={sponsor_filter}" if sponsor_filter else ""))

        for u in qs.only("id", "username", "registered_by"):
            sponsor: Optional[CustomUser] = getattr(u, "registered_by", None)
            if not sponsor:
                skipped_no_sponsor += 1
                continue

            total += 1
            exists = WalletTransaction.objects.filter(
                user=sponsor,
                type="DIRECT_REF_BONUS",
                source_type="JOIN_REFERRAL",
                source_id=str(u.id),
            ).exists()

            if exists:
                already += 1
                continue

            meta = {
                "source": "JOIN_REFERRAL",
                "from_user": getattr(u, "username", None),
                "from_user_id": getattr(u, "id", None),
                "backfill": True,
            }

            if dry_run:
                self.stdout.write(f"[DRY-RUN] Would credit sponsor={sponsor.username} +₹{direct_amount} for new_user={u.username} ({u.id})")
                created += 1
                continue

            try:
                w = Wallet.get_or_create_for_user(sponsor)
                w.credit(
                    direct_amount,
                    tx_type="DIRECT_REF_BONUS",
                    meta=meta,
                    source_type="JOIN_REFERRAL",
                    source_id=str(u.id),
                )
                created += 1
                self.stdout.write(self.style.SUCCESS(
                    f"Credited sponsor={sponsor.username} +₹{direct_amount} for new_user={u.username} ({u.id})"
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"Failed credit for sponsor={getattr(sponsor, 'username', 'NA')} new_user={u.username} ({u.id}): {e}"
                ))

        self.stdout.write("")
        self.stdout.write(self.style.NOTICE(f"Total referred users scanned: {total}"))
        self.stdout.write(self.style.NOTICE(f"Already had DIRECT_REF_BONUS: {already}"))
        self.stdout.write(self.style.SUCCESS(f"New DIRECT_REF_BONUS created: {created}"))
        if skipped_no_sponsor:
            self.stdout.write(self.style.WARNING(f"Skipped without sponsor: {skipped_no_sponsor}"))
        if dry_run:
            self.stdout.write(self.style.WARNING("Dry run complete. No changes written."))

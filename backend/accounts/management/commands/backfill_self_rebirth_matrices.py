from django.core.management.base import BaseCommand
from django.db import transaction
from accounts.models import CustomUser, WalletTransaction
from business.models import AutoPoolAccount
from business.services.prime import distribute_prime_150_payouts


class Command(BaseCommand):
    help = "Backfill missing 5-matrix and 3-matrix accounts for SELF_250_PACK purchases."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be processed without applying changes.",
        )
        parser.add_argument(
            "--phone",
            type=str,
            help="Filter backfill to a specific user's phone number.",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Filter backfill to transactions created in the last N days (default: 30). Use 0 for all history.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        phone = options.get("phone")
        days = options.get("days", 30)

        # Query all AUTO_PURCHASE_DEBIT transactions that correspond to SELF_250_PACK purchases
        qs = WalletTransaction.objects.filter(
            type="AUTO_PURCHASE_DEBIT",
            source_type="SELF_250_PACK"
        )

        if days > 0:
            from django.utils import timezone
            from datetime import timedelta
            cutoff = timezone.now() - timedelta(days=days)
            qs = qs.filter(created_at__gte=cutoff)

        qs = qs.order_by("created_at")

        if phone:
            user = CustomUser.objects.filter(username=phone).first()
            if not user:
                self.stderr.write(f"User with phone/username {phone} not found.")
                return
            qs = qs.filter(user=user)

        total = qs.count()
        self.stdout.write(self.style.NOTICE(f"Scanning {total} SELF_250_PACK purchase transactions (last {days} days)..."))

        processed = 0
        fixed = 0

        for tx in qs.iterator():
            user = tx.user
            pack_index = tx.source_id  # pack_index is stored in source_id for AUTO_PURCHASE_DEBIT
            if not pack_index:
                continue

            processed += 1

            # Check if 5-matrix and 3-matrix accounts exist for this specific pack purchase
            exists_five = AutoPoolAccount.objects.filter(
                owner=user,
                pool_type="FIVE_150",
                source_type="SELF_250_PACK",
                source_id=str(pack_index)
            ).exists()

            exists_three = AutoPoolAccount.objects.filter(
                owner=user,
                pool_type="THREE_150",
                source_type="SELF_250_PACK",
                source_id=str(pack_index)
            ).exists()

            # If either matrix account is missing, trigger the distribution logic (idempotent for other parts)
            if not exists_five or not exists_three:
                status_str = []
                if not exists_five:
                    status_str.append("FIVE_150 missing")
                if not exists_three:
                    status_str.append("THREE_150 missing")

                self.stdout.write(
                    self.style.WARNING(
                        f"User {user.username} (ID: {user.id}) pack index {pack_index} is missing matrix: {', '.join(status_str)}"
                    )
                )

                if dry_run:
                    self.stdout.write(f"[DRY] Would run distribute_prime_150_payouts for user {user.username} index {pack_index}")
                else:
                    try:
                        with transaction.atomic():
                            distribute_prime_150_payouts(
                                user,
                                source={"type": "SELF_250_PACK", "id": str(pack_index)}
                            )
                        self.stdout.write(self.style.SUCCESS(f"Successfully processed matrix creation for user {user.username} index {pack_index}"))
                        fixed += 1
                    except Exception as e:
                        self.stderr.write(f"Error processing user {user.username} index {pack_index}: {e}")
            else:
                # Both exist, nothing to do
                pass

        if dry_run:
            self.stdout.write(self.style.WARNING(f"[DRY] Done. Dry-run complete. Would have fixed {fixed} of {processed} processed transactions."))
        else:
            self.stdout.write(self.style.SUCCESS(f"Done. Successfully fixed {fixed} of {processed} processed transactions."))

"""
Management command: audit_add_money_wallet

Audits (and optionally repairs) the Add Money Pocket balance discrepancy
for one or more users.

Usage
-----
# Audit a single user (read-only, safe):
    python manage.py audit_add_money_wallet --phone 9591119778

# Audit all users with an Add Money credit transaction:
    python manage.py audit_add_money_wallet --all

# Actually create the missing debit WalletTransaction to correct the DB:
    python manage.py audit_add_money_wallet --phone 9591119778 --fix
"""
from __future__ import annotations

from decimal import Decimal as D

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q, Sum


class Command(BaseCommand):
    help = "Audit and optionally repair Add Money Pocket wallet balance for users."

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group(required=True)
        group.add_argument("--phone", help="Phone number (= username) of the user to audit")
        group.add_argument("--all", action="store_true", dest="all_users",
                           help="Audit every user who has an Add Money credit transaction")
        parser.add_argument("--fix", action="store_true",
                            help="Create missing debit WalletTransaction(s) to correct the balance")

    def handle(self, *args, **options):
        from accounts.models import CustomUser, WalletTransaction

        upload_sources = ["WALLET_UPLOAD", "UPLOAD_TO_WALLET", "PACKAGE_UPLOAD", "PACKAGE_BUY_UPLOAD"]

        add_money_credit_filter = (
            Q(source_type__in=upload_sources)
            | Q(meta__wallet="ADD_MONEY")
            | Q(meta__destination_wallet="ADD_MONEY_POCKET")
            | Q(meta__legacy_wallet_type="ADD_MONEY_POCKET")
        )

        if options["all_users"]:
            user_ids = (
                WalletTransaction.objects
                .filter(add_money_credit_filter, amount__gt=0)
                .values_list("user_id", flat=True)
                .distinct()
            )
            users = CustomUser.objects.filter(id__in=user_ids)
        else:
            phone = options["phone"].strip()
            try:
                users = [CustomUser.objects.get(username=phone)]
            except CustomUser.DoesNotExist:
                raise CommandError(f"User with phone/username '{phone}' not found.")

        add_money_filter = (
            Q(source_type__in=upload_sources)
            | Q(meta__wallet="ADD_MONEY")
            | Q(meta__destination_wallet="ADD_MONEY_POCKET")
            | Q(meta__legacy_wallet_type="ADD_MONEY_POCKET")
            | Q(meta__wallet_source="package_upload")
        )

        for user in users:
            tx_all = WalletTransaction.objects.filter(user=user)

            # All add-money credits
            credit_qs = tx_all.filter(add_money_filter, amount__gt=0)
            debit_qs = tx_all.filter(add_money_filter, amount__lt=0)

            total_credit = credit_qs.aggregate(t=Sum("amount"))["t"] or D("0.00")
            total_debit = debit_qs.aggregate(t=Sum("amount"))["t"] or D("0.00")
            tx_balance = (D(str(total_credit)) + D(str(total_debit))).quantize(D("0.01"))

            # Cross-check with purchase records
            try:
                from business.models import PromoPurchase
                wallet_purchases = PromoPurchase.objects.filter(
                    user=user,
                    payment_mode="WALLET",
                ).exclude(status="REJECTED")
                total_purchase_debit = D("0.00")
                purchase_details = []
                for pp in wallet_purchases:
                    amt = D(str(pp.amount_paid or 0))
                    total_purchase_debit += amt
                    purchase_details.append(
                        f"  Purchase #{pp.id}: ₹{amt} [{pp.status}] pkg={pp.package_id} date={pp.requested_at}"
                    )
            except Exception as exc:
                total_purchase_debit = D("0.00")
                purchase_details = [f"  (Could not load purchases: {exc})"]

            # How much of total_purchase_debit is already in debit transactions?
            recorded_debit_amt = abs(D(str(total_debit)))
            unrecorded_debit = (total_purchase_debit - recorded_debit_amt).quantize(D("0.01"))

            self.stdout.write(
                self.style.HTTP_INFO(
                    f"\n{'='*60}\n"
                    f"User: {user.username}  (id={user.id})\n"
                    f"  Add Money credits (tx):   ₹{total_credit}\n"
                    f"  Add Money debits  (tx):   ₹{total_debit}\n"
                    f"  TX-based balance:          ₹{tx_balance}\n"
                    f"  Wallet purchases total:   ₹{total_purchase_debit}\n"
                    f"  Already recorded debits:  ₹{recorded_debit_amt}\n"
                    f"  Unrecorded purchase debit: ₹{unrecorded_debit}"
                )
            )
            for line in purchase_details:
                self.stdout.write(line)

            if unrecorded_debit > D("0.00"):
                self.stdout.write(
                    self.style.WARNING(
                        f"  ⚠ Balance discrepancy: UI shows ₹{D(str(total_credit)).quantize(D('0.01'))} "
                        f"but should be ₹{tx_balance}"
                    )
                )
                if options["fix"]:
                    self._create_repair_debit(user, unrecorded_debit)
                else:
                    self.stdout.write("  → Run with --fix to create the missing debit transaction.")
            else:
                self.stdout.write(self.style.SUCCESS("  ✓ Balance looks correct."))

        self.stdout.write("\nDone.")

    def _create_repair_debit(self, user, amount: D):
        from accounts.models import Wallet, WalletTransaction
        self.stdout.write(f"  Creating repair debit of ₹{amount} for {user.username}...")
        try:
            with transaction.atomic():
                w = Wallet.objects.select_for_update().get_or_create(user=user)[0]
                WalletTransaction.objects.create(
                    user=user,
                    amount=amount * D("-1"),
                    balance_after=w.balance,
                    type="INTERNAL_WALLET_DEBIT",
                    meta={
                        "reason": "PROMO_PURCHASE_REPAIR",
                        "wallet_source": "package_upload",
                        "note": "Backfill debit — wallet debit was not recorded at purchase time",
                    },
                    source_type="WALLET_UPLOAD",
                    source_id="",
                )
            self.stdout.write(
                self.style.SUCCESS(f"  ✓ Repair debit of ₹{amount} created for {user.username}.")
            )
        except Exception as exc:
            self.stdout.write(self.style.ERROR(f"  ✗ Failed to create repair debit: {exc}"))

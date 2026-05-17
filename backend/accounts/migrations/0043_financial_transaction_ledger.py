import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0042_alter_consumervoucher_voucher_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="FinancialTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("transaction_ref", models.CharField(db_index=True, max_length=64, unique=True)),
                ("flow_id", models.CharField(blank=True, db_index=True, max_length=64)),
                ("idempotency_key", models.CharField(blank=True, max_length=128, null=True, unique=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("ADD_MONEY", "Add Money"),
                            ("WITHDRAWAL", "Withdrawal"),
                            ("WALLET_TRANSFER", "Wallet Transfer"),
                            ("VOUCHER_CREATE", "Voucher Creation"),
                            ("VOUCHER_REDEEM", "Voucher Redemption"),
                            ("PACKAGE_PURCHASE", "Package Purchase"),
                            ("MLM_INCOME", "MLM Income"),
                            ("SPONSOR_INCOME", "Sponsor Income"),
                            ("MATRIX_INCOME", "Matrix Earnings"),
                            ("SELF_REBIRTH", "Self Rebirth"),
                            ("SHOPPING_REWARD", "Shopping Rewards"),
                            ("FRANCHISE_REWARD", "Franchise Rewards"),
                            ("REWARD_DISTRIBUTION", "Reward Distribution"),
                            ("GST_INVOICE", "GST Invoice"),
                            ("ADMIN_ADJUSTMENT", "Admin Adjustment"),
                            ("REFUND", "Refund"),
                            ("SETTLEMENT", "Settlement"),
                        ],
                        db_index=True,
                        max_length=40,
                    ),
                ),
                ("source_module", models.CharField(blank=True, db_index=True, max_length=80)),
                ("source_id", models.CharField(blank=True, db_index=True, max_length=80)),
                ("destination_module", models.CharField(blank=True, max_length=80)),
                ("gross_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("charges_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("gst_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("tds_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("net_amount", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("DRAFT", "Draft"),
                            ("PENDING", "Pending"),
                            ("PROCESSING", "Processing"),
                            ("COMPLETED", "Completed"),
                            ("FAILED", "Failed"),
                            ("REVERSED", "Reversed"),
                            ("CANCELLED", "Cancelled"),
                        ],
                        db_index=True,
                        default="PENDING",
                        max_length=20,
                    ),
                ),
                (
                    "approval_status",
                    models.CharField(
                        choices=[
                            ("NOT_REQUIRED", "Not Required"),
                            ("PENDING", "Pending"),
                            ("APPROVED", "Approved"),
                            ("REJECTED", "Rejected"),
                            ("CANCELLED", "Cancelled"),
                        ],
                        db_index=True,
                        default="NOT_REQUIRED",
                        max_length=20,
                    ),
                ),
                ("payment_gateway_reference", models.CharField(blank=True, db_index=True, max_length=120)),
                ("utr_number", models.CharField(blank=True, db_index=True, max_length=80)),
                ("reference_id", models.CharField(blank=True, db_index=True, max_length=100)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("remarks", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "approved_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="approved_financial_transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="created_financial_transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "legacy_wallet_transaction",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="financial_transactions",
                        to="accounts.wallettransaction",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        db_index=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="financial_transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="WalletAccount",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "wallet_type",
                    models.CharField(
                        choices=[
                            ("MAIN", "Main Wallet"),
                            ("TOTAL_EARNINGS", "Total Earnings"),
                            ("REDEEM_POINTS", "Redeem Points"),
                            ("COUPON_POCKET", "Coupon Pocket"),
                            ("SELF_PACKAGE_POCKET", "Self Package Pocket"),
                            ("ADD_MONEY_POCKET", "Add Money Pocket"),
                            ("WITHDRAWAL_WALLET", "Withdrawal Wallet"),
                            ("PACKAGE_PURCHASE_COUPON", "Package Purchase Coupon"),
                            ("SHOPPING_REBIRTH", "Shopping/Rebirth Wallets"),
                            ("REWARD_WALLET", "Reward Wallet"),
                            ("GIFT_CARD", "Gift Cards"),
                            ("ECOMMERCE", "B2B/B2C Orders"),
                            ("SYSTEM", "System/Company Wallet"),
                        ],
                        db_index=True,
                        max_length=40,
                    ),
                ),
                ("current_balance", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("available_balance", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("locked_balance", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("pending_balance", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                (
                    "status",
                    models.CharField(
                        choices=[("ACTIVE", "Active"), ("LOCKED", "Locked"), ("SUSPENDED", "Suspended"), ("CLOSED", "Closed")],
                        db_index=True,
                        default="ACTIVE",
                        max_length=20,
                    ),
                ),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "legacy_wallet",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="wallet_accounts",
                        to="accounts.wallet",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_index=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="wallet_accounts",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["user_id", "wallet_type"],
            },
        ),
        migrations.CreateModel(
            name="LedgerEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("direction", models.CharField(choices=[("DEBIT", "Debit"), ("CREDIT", "Credit")], db_index=True, max_length=10)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=14)),
                ("balance_before", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                ("balance_after", models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=14)),
                (
                    "status",
                    models.CharField(
                        choices=[("POSTED", "Posted"), ("PENDING", "Pending"), ("REVERSED", "Reversed")],
                        db_index=True,
                        default="POSTED",
                        max_length=20,
                    ),
                ),
                ("entry_ref", models.CharField(blank=True, db_index=True, max_length=80)),
                ("remarks", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                (
                    "financial_transaction",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="accounts.financialtransaction"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        db_index=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ledger_entries",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "wallet_account",
                    models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="ledger_entries", to="accounts.walletaccount"),
                ),
            ],
            options={
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="financialtransaction",
            index=models.Index(fields=["category", "status", "created_at"], name="accounts_fi_categor_2c0c1a_idx"),
        ),
        migrations.AddIndex(
            model_name="financialtransaction",
            index=models.Index(fields=["source_module", "source_id"], name="accounts_fi_source__1a4780_idx"),
        ),
        migrations.AddIndex(
            model_name="financialtransaction",
            index=models.Index(fields=["user", "status", "created_at"], name="accounts_fi_user_id_55b4f3_idx"),
        ),
        migrations.AddIndex(
            model_name="financialtransaction",
            index=models.Index(fields=["approval_status", "created_at"], name="accounts_fi_approva_df1d05_idx"),
        ),
        migrations.AddIndex(
            model_name="financialtransaction",
            index=models.Index(fields=["flow_id", "created_at"], name="accounts_fi_flow_id_8a45cc_idx"),
        ),
        migrations.AddIndex(
            model_name="walletaccount",
            index=models.Index(fields=["wallet_type", "status"], name="accounts_wa_wallet_70de35_idx"),
        ),
        migrations.AddIndex(
            model_name="walletaccount",
            index=models.Index(fields=["user", "status"], name="accounts_wa_user_id_5fc05d_idx"),
        ),
        migrations.AddConstraint(
            model_name="walletaccount",
            constraint=models.UniqueConstraint(fields=("user", "wallet_type"), name="uniq_wallet_account_user_type"),
        ),
        migrations.AddIndex(
            model_name="ledgerentry",
            index=models.Index(fields=["wallet_account", "created_at"], name="accounts_le_wallet_464d24_idx"),
        ),
        migrations.AddIndex(
            model_name="ledgerentry",
            index=models.Index(fields=["financial_transaction", "direction"], name="accounts_le_financi_2f1cfa_idx"),
        ),
        migrations.AddIndex(
            model_name="ledgerentry",
            index=models.Index(fields=["user", "created_at"], name="accounts_le_user_id_29d645_idx"),
        ),
        migrations.AddIndex(
            model_name="ledgerentry",
            index=models.Index(fields=["status", "created_at"], name="accounts_le_status_51ce7f_idx"),
        ),
    ]

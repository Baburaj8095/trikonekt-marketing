from decimal import Decimal

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0044_state_only_index_name_drift"),
    ]

    operations = [
        migrations.AddField(
            model_name="wallet",
            name="franchise_total_earning",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="wallet",
            name="franchise_active_work",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="wallet",
            name="franchise_inactive_work",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="wallet",
            name="franchise_self_rebirth",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="wallet",
            name="franchise_company_marketing",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="wallet",
            name="franchise_reward_points",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="wallet",
            name="franchise_shopping_scanner",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.CreateModel(
            name="FranchiseWalletSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("inactive_work_day", models.PositiveSmallIntegerField(default=30)),
                ("inactive_work_enabled", models.BooleanField(default=True)),
                ("reward_min_withdrawal", models.DecimalField(decimal_places=2, default=Decimal("1000.00"), max_digits=12)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Franchise Wallet Settings",
                "verbose_name_plural": "Franchise Wallet Settings",
            },
        ),
        migrations.CreateModel(
            name="FranchiseWorkApproval",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("year", models.PositiveSmallIntegerField(db_index=True)),
                ("month", models.PositiveSmallIntegerField(db_index=True)),
                ("status", models.CharField(choices=[("PENDING", "Pending"), ("APPROVED", "Approved"), ("REJECTED", "Rejected")], db_index=True, default="PENDING", max_length=16)),
                ("note", models.TextField(blank=True)),
                ("approved_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="franchise_work_approvals_decided", to=settings.AUTH_USER_MODEL)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="franchise_work_approvals", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-year", "-month", "-updated_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="franchiseworkapproval",
            constraint=models.UniqueConstraint(fields=("user", "year", "month"), name="uniq_franchise_work_approval_user_month"),
        ),
        migrations.AddIndex(
            model_name="franchiseworkapproval",
            index=models.Index(fields=["year", "month", "status"], name="accounts_fr_year_cb85df_idx"),
        ),
        migrations.AddIndex(
            model_name="franchiseworkapproval",
            index=models.Index(fields=["user", "status"], name="accounts_fr_user_id_e72be6_idx"),
        ),
        migrations.AlterField(
            model_name="wallettransaction",
            name="type",
            field=models.CharField(choices=[
                ("COUPON_PURCHASE_CREDIT", "Coupon Purchase Credit"),
                ("REDEEM_ECOUPON_CREDIT", "E-Coupon Redeem Credit"),
                ("PRODUCT_PURCHASE_DEBIT", "Product Purchase Debit"),
                ("BANNER_PURCHASE_DEBIT", "Banner Purchase Debit"),
                ("COMMISSION_CREDIT", "Commission Credit"),
                ("AUTO_POOL_DEBIT", "Auto Pool Debit"),
                ("ADJUSTMENT_CREDIT", "Adjustment Credit"),
                ("ADJUSTMENT_DEBIT", "Adjustment Debit"),
                ("REFUND_CREDIT", "Refund Credit"),
                ("PRIME_ACTIVATION_CREDIT", "Prime Activation Credit"),
                ("GLOBAL_ACTIVATION_CREDIT", "Global Activation Credit"),
                ("DIRECT_REF_BONUS", "Direct Referral Bonus"),
                ("WELCOME_BONUS", "Welcome Bonus"),
                ("SELF_BONUS_ACTIVE", "Self Bonus (Active)"),
                ("LEVEL_BONUS", "Level Bonus"),
                ("AUTOPOOL_BONUS_FIVE", "Auto-Pool Bonus (5-Matrix)"),
                ("AUTOPOOL_BONUS_THREE", "Auto-Pool Bonus (3-Matrix)"),
                ("WITHDRAWAL_DEBIT", "Withdrawal Debit"),
                ("LIFETIME_WITHDRAWAL_BONUS", "Lifetime Withdrawal Bonus"),
                ("GLOBAL_ROYALTY", "Global Royalty"),
                ("REWARD_CREDIT", "Reward Credit"),
                ("REWARD_DEBIT", "Reward Debit"),
                ("FRANCHISE_INCOME", "Franchise Income"),
                ("WITHDRAWABLE_CREDIT", "Withdrawable Credit"),
                ("TAX_POOL_CREDIT", "Tax Pool Credit"),
                ("ECOUPON_WALLET_DEBIT", "E-Coupon Wallet Debit"),
                ("AUTO_PURCHASE_DEBIT", "Auto Purchase Debit"),
                ("PRODUCT_WALLET_CREDIT", "Product Wallet Credit"),
                ("SHOPPING_WALLET_CREDIT", "Shopping Wallet Credit"),
                ("SHOPPING_WALLET_DEBIT", "Shopping Wallet Debit"),
                ("SHOPPING_WALLET_TRANSFER_OUT", "Shopping Wallet Transfer Out"),
                ("COUPON_WALLET_CREDIT", "Coupon Wallet Credit"),
                ("COUPON_WALLET_DEBIT", "Coupon Wallet Debit"),
                ("COUPON_WALLET_TRANSFER_OUT", "Coupon Wallet Transfer Out"),
                ("COUPON_WALLET_REFUND", "Coupon Wallet Refund"),
                ("PACKAGE_COUPON_WALLET_CREDIT", "Package Coupon Wallet Credit"),
                ("PACKAGE_COUPON_WALLET_DEBIT", "Package Coupon Wallet Debit"),
                ("VOUCHER_CREATE_DEBIT", "Voucher Create Debit"),
                ("VOUCHER_REDEEM_CREDIT", "Voucher Redeem Credit"),
                ("INTERNAL_WALLET_CREDIT", "Internal Wallet Credit"),
                ("INTERNAL_WALLET_DEBIT", "Internal Wallet Debit"),
                ("INTERNAL_WALLET_TRANSFER_OUT", "Internal Wallet Transfer Out"),
                ("WALLET_TO_WALLET_IN", "Wallet To Wallet In"),
                ("WALLET_TO_WALLET_OUT", "Wallet To Wallet Out"),
                ("WITHDRAWAL_WALLET_TRANSFER_OUT", "Withdrawal Wallet Transfer Out"),
                ("WITHDRAWAL_WALLET_CREDIT", "Withdrawal Wallet Credit"),
                ("FRANCHISE_WD_CREDIT", "Franchise Withdrawal Credit"),
                ("FRANCHISE_WD_TRANSFER", "Franchise Withdrawal Transfer"),
                ("FRANCHISE_REWARD_CREDIT", "Franchise Reward Credit"),
                ("INCOME_CREDIT_75", "Income Credit"),
                ("SELF_ACCOUNT_CREDIT", "Self Account Credit"),
                ("SELF_ACCOUNT_DEBIT", "Self Account Debit (250 Pack)"),
                ("AUTO_ECOUPON_ISSUED", "Auto E-Coupon Issued"),
            ], db_index=True, max_length=32),
        ),
    ]

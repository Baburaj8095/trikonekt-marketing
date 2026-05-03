from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0038_walletuploadrequest_alter_wallettransaction_options_and_more"),
        ("business", "0041_add_tri_app_slug_to_promopurchase"),
    ]

    operations = [
        migrations.AddField(
            model_name="promopurchase",
            name="payment_mode",
            field=models.CharField(
                choices=[("MANUAL", "MANUAL"), ("WALLET", "WALLET")],
                db_index=True,
                default="MANUAL",
                help_text="MANUAL=UPI proof upload, WALLET=self package (internal) wallet",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="promopurchase",
            name="wallet_debit_tx",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="promo_wallet_debits",
                to="accounts.wallettransaction",
            ),
        ),
        migrations.AddField(
            model_name="promopurchase",
            name="wallet_refund_tx",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="promo_wallet_refunds",
                to="accounts.wallettransaction",
            ),
        ),
        migrations.AddIndex(
            model_name="promopurchase",
            index=models.Index(fields=["payment_mode", "status", "requested_at"], name="business_pro_payment_67e26b_idx"),
        ),
    ]

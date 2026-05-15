from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0041_consumervoucher_coupon_wallet_types"),
    ]

    operations = [
        migrations.AlterField(
            model_name="consumervoucher",
            name="voucher_type",
            field=models.CharField(
                choices=[
                    ("TRIZONE", "Triozone Coupon"),
                    ("ONLINE", "Online Coupon"),
                    ("NEAR_STORE", "Near Store Coupon"),
                    ("PACKAGE_PURCHASE", "Self Package Coupon"),
                ],
                db_index=True,
                max_length=32,
            ),
        ),
    ]

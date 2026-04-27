from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0033_commissionconfig_withdrawals_window"),
    ]

    operations = [
        # Speed full-history backfill / seat existence checks
        migrations.AddIndex(
            model_name="autopoolaccount",
            index=models.Index(
                fields=["owner", "pool_type", "status", "source_id"],
                name="idx_ap_owner_pool_status_sourceid",
            ),
        ),
        migrations.AddIndex(
            model_name="autopoolaccount",
            index=models.Index(
                fields=["owner", "pool_type", "status", "source_type"],
                name="idx_ap_owner_pool_status_sourcetype",
            ),
        ),
        migrations.AddIndex(
            model_name="autopoolaccount",
            index=models.Index(
                fields=["pool_type", "status", "source_type", "source_id"],
                name="idx_ap_pool_status_type_id",
            ),
        ),
    ]

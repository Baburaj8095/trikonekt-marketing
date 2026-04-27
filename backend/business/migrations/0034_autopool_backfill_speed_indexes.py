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
                # Keep <= 30 chars for cross-DB compatibility
                name="ap_owner_pool_stat_sid",
            ),
        ),
        migrations.AddIndex(
            model_name="autopoolaccount",
            index=models.Index(
                fields=["owner", "pool_type", "status", "source_type"],
                # Keep <= 30 chars for cross-DB compatibility
                name="ap_owner_pool_stat_st",
            ),
        ),
        migrations.AddIndex(
            model_name="autopoolaccount",
            index=models.Index(
                fields=["pool_type", "status", "source_type", "source_id"],
                # Keep <= 30 chars for cross-DB compatibility
                name="ap_pool_stat_st_sid",
            ),
        ),
    ]

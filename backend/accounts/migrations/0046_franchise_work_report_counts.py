from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0045_franchise_wallet_buckets"),
    ]

    operations = [
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="consumer_subscription_750_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="prime_subscription_8250_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="smart_purchase_plan_1000_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="franchise_reference_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="captain_business_connect_reference_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="tri_trip_reference_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="organized_meeting_count",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="franchiseworkapproval",
            name="submitted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]

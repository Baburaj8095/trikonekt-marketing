from django.db import migrations, models
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0032_autopoolaccount_uniq_single_sentinel_per_pool"),
    ]

    operations = [
        migrations.AddField(
            model_name="commissionconfig",
            name="withdrawals_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="commissionconfig",
            name="withdrawals_weekday",
            field=models.PositiveSmallIntegerField(default=2, help_text="0=Mon .. 6=Sun"),
        ),
        migrations.AddField(
            model_name="commissionconfig",
            name="withdrawals_start_time",
            field=models.TimeField(default=django.utils.timezone.datetime.strptime("00:00", "%H:%M").time),
        ),
        migrations.AddField(
            model_name="commissionconfig",
            name="withdrawals_end_time",
            field=models.TimeField(default=django.utils.timezone.datetime.strptime("23:59", "%H:%M").time),
        ),
    ]

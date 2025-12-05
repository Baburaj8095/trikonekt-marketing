from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('business', '0014_promopurchase_quantity'),
    ]

    operations = [
        migrations.AddField(
            model_name='commissionconfig',
            name='reward_points_config_json',
            field=models.JSONField(default=dict, help_text='Admin-configurable reward points schedule: {"tiers":[{"count":1,"points":1000},...], "after":{"base_count":5,"per_coupon":20000}}'),
        ),
    ]

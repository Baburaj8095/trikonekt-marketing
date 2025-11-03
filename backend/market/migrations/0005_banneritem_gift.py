# Generated manually to add 'gift' field to BannerItem
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("market", "0004_rename_market_ban_banner__b6f3a7_idx_market_bann_banner__16de9b_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="banneritem",
            name="gift",
            field=models.CharField(max_length=255, blank=True, default=""),
        ),
    ]

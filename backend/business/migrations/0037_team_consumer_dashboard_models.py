from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("business", "0036_franchise_dashboard_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeamConsumerWishingBanner",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, default="", max_length=180)),
                ("image", models.ImageField(blank=True, null=True, upload_to="team_consumer/wishing_banners/")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Team/Consumer Wishing Banner",
                "verbose_name_plural": "Team/Consumer Wishing Banners",
                "ordering": ["-created_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="TeamConsumerTopAchiever",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(blank=True, default="", max_length=180)),
                ("achieved", models.CharField(blank=True, default="", max_length=220)),
                ("sort_order", models.IntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("photo", models.ImageField(blank=True, null=True, upload_to="team_consumer/top_achievers/")),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Team/Consumer Top Achiever",
                "verbose_name_plural": "Team/Consumer Top Achievers",
                "ordering": ["sort_order", "-created_at", "id"],
            },
        ),
    ]

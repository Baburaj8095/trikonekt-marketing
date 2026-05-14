# Generated manually for Team/Consumer dashboard uploads.

import cloudinary_storage.storage
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0042_promopurchase_wallet_payment_mode"),
    ]

    operations = [
        migrations.CreateModel(
            name="TeamConsumerEducationalVideo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, default="", max_length=180)),
                ("description", models.TextField(blank=True, default="")),
                ("sort_order", models.IntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                (
                    "video",
                    models.FileField(
                        blank=True,
                        max_length=500,
                        null=True,
                        storage=cloudinary_storage.storage.RawMediaCloudinaryStorage(),
                        upload_to="team_consumer/educational_videos/",
                    ),
                ),
                (
                    "thumbnail",
                    models.ImageField(
                        blank=True,
                        max_length=500,
                        null=True,
                        storage=cloudinary_storage.storage.MediaCloudinaryStorage(),
                        upload_to="team_consumer/educational_video_thumbnails/",
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Team/Consumer Educational Video",
                "verbose_name_plural": "Team/Consumer Educational Videos",
                "ordering": ["sort_order", "-created_at", "id"],
            },
        ),
        migrations.CreateModel(
            name="TeamConsumerDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("PDF", "Trikonekt PDF"), ("CERTIFICATE", "Certificate")], db_index=True, max_length=24)),
                ("title", models.CharField(blank=True, default="", max_length=180)),
                (
                    "file",
                    models.FileField(
                        blank=True,
                        max_length=500,
                        null=True,
                        storage=cloudinary_storage.storage.RawMediaCloudinaryStorage(),
                        upload_to="team_consumer/documents/",
                    ),
                ),
                ("sort_order", models.IntegerField(db_index=True, default=0)),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Team/Consumer Document",
                "verbose_name_plural": "Team/Consumer Documents",
                "ordering": ["kind", "sort_order", "-created_at", "id"],
            },
        ),
    ]

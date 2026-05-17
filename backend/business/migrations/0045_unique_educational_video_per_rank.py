from django.db import migrations, models


def dedupe_educational_videos_per_rank(apps, schema_editor):
    Video = apps.get_model("business", "TeamConsumerEducationalVideo")
    rank_ids = (
        Video.objects
        .exclude(required_rank_id__isnull=True)
        .values_list("required_rank_id", flat=True)
        .distinct()
    )
    for rank_id in rank_ids:
        videos = list(Video.objects.filter(required_rank_id=rank_id).order_by("sort_order", "-created_at", "id"))
        for duplicate in videos[1:]:
            duplicate.required_rank_id = None
            duplicate.is_active = False
            duplicate.save(update_fields=["required_rank", "is_active"])


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0044_teamconsumereducationalvideo_required_rank"),
    ]

    operations = [
        migrations.RunPython(dedupe_educational_videos_per_rank, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="teamconsumereducationalvideo",
            constraint=models.UniqueConstraint(
                fields=("required_rank",),
                condition=models.Q(required_rank__isnull=False),
                name="uniq_team_consumer_education_video_per_rank",
            ),
        ),
    ]

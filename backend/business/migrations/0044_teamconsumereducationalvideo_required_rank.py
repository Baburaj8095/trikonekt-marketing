from django.db import migrations, models
import django.db.models.deletion


def map_existing_videos_to_ranks(apps, schema_editor):
    Video = apps.get_model("business", "TeamConsumerEducationalVideo")
    Rank = apps.get_model("mlm_ranks", "Rank")
    ranks = {int(r.level_number): r.id for r in Rank.objects.all()}
    videos = list(Video.objects.order_by("sort_order", "created_at", "id"))
    for idx, video in enumerate(videos, start=1):
        level = None
        try:
            so = int(video.sort_order or 0)
            if 1 <= so <= 10:
                level = so
        except Exception:
            level = None
        if level is None:
            level = idx
        rank_id = ranks.get(level)
        if rank_id:
            video.required_rank_id = rank_id
            video.save(update_fields=["required_rank"])


class Migration(migrations.Migration):

    dependencies = [
        ("mlm_ranks", "0007_remove_rankmatrixnode_mlm_ranks_r_root_us_b9bebf_idx_and_more"),
        ("business", "0043_team_consumer_documents_videos"),
    ]

    operations = [
        migrations.AddField(
            model_name="teamconsumereducationalvideo",
            name="required_rank",
            field=models.ForeignKey(
                blank=True,
                help_text="Digital Education Prime rank required to unlock this video.",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="educational_videos",
                to="mlm_ranks.rank",
            ),
        ),
        migrations.RunPython(map_existing_videos_to_ranks, migrations.RunPython.noop),
    ]

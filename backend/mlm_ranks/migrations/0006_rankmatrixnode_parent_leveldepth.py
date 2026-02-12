# Generated manually to align RankMatrixNode with parent_user and level_depth (BFS spillover)
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def seed_parent_and_level(apps, schema_editor):
    RankMatrixNode = apps.get_model("mlm_ranks", "RankMatrixNode")
    db_alias = schema_editor.connection.alias
    # For all existing rows (which represented Level-1 under root), set:
    # - parent_user = root_user
    # - level_depth = 1
    for row in RankMatrixNode.objects.using(db_alias).all():
        # Fallbacks for safety
        row.parent_user_id = row.root_user_id
        if not getattr(row, "level_depth", None):
            row.level_depth = 1
        row.save(update_fields=["parent_user_id", "level_depth"])


class Migration(migrations.Migration):

    dependencies = [
        ("mlm_ranks", "0005_rankmatrixnode_rankmatrixroot"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1) Add nullable parent_user and level_depth
        migrations.AddField(
            model_name="rankmatrixnode",
            name="parent_user",
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="rank_matrix_as_parent",
                null=True,
                blank=True,
                db_index=True,
            ),
        ),
        migrations.AddField(
            model_name="rankmatrixnode",
            name="level_depth",
            field=models.PositiveSmallIntegerField(default=1, db_index=True),
        ),
        # 2) Seed data: parent_user=root_user, level_depth=1 for legacy rows
        migrations.RunPython(seed_parent_and_level, reverse_code=migrations.RunPython.noop),
        # 3) Make parent_user non-nullable
        migrations.AlterField(
            model_name="rankmatrixnode",
            name="parent_user",
            field=models.ForeignKey(
                to=settings.AUTH_USER_MODEL,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="rank_matrix_as_parent",
                null=False,
                db_index=True,
            ),
        ),
        # 4) Update uniques and ordering
        migrations.AlterUniqueTogether(
            name="rankmatrixnode",
            unique_together={
                ("root_user", "placed_user"),
                ("root_user", "parent_user", "position"),
            },
        ),
        migrations.AlterModelOptions(
            name="rankmatrixnode",
            options={"ordering": ["level_depth", "approved_at", "position", "id"]},
        ),
        # 5) Add indexes to support BFS lookups
        migrations.AddIndex(
            model_name="rankmatrixnode",
            index=models.Index(fields=["root_user", "parent_user", "position"], name="mx_idx_root_parent_pos"),
        ),
        migrations.AddIndex(
            model_name="rankmatrixnode",
            index=models.Index(fields=["root_user", "level_depth"], name="mx_idx_root_level"),
        ),
    ]

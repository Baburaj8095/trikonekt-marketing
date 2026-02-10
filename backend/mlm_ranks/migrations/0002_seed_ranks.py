from django.db import migrations
from decimal import Decimal


def seed_ranks(apps, schema_editor):
    Rank = apps.get_model("mlm_ranks", "Rank")
    data = [
        # level_number, rank_name, team_size_required, upgrade_amount
        (1, "L1 Prime Starter", 5, Decimal("250.00")),
        (2, "L2 Builder", 25, Decimal("500.00")),
        (3, "L3 Achiever", 125, Decimal("1000.00")),
        (4, "L4 Champion", 625, Decimal("1250.00")),
        (5, "L5 Captain", 3125, Decimal("1500.00")),
        (6, "L6 Master", 15625, Decimal("1750.00")),
        (7, "L7 Grand Master Leader", 78125, Decimal("2000.00")),
        (8, "L8 Leader", 390625, Decimal("5000.00")),
        (9, "L9 Crown Master", 1953125, Decimal("10000.00")),
        (10, "L10 Legend", 9765625, Decimal("25000.00")),
    ]
    for lvl, name, team, amt in data:
        Rank.objects.update_or_create(
            level_number=lvl,
            defaults={
                "rank_name": name,
                "team_size_required": int(team),
                "upgrade_amount": amt,
            },
        )


def unseed_ranks(apps, schema_editor):
    Rank = apps.get_model("mlm_ranks", "Rank")
    # Only delete the exact seeded names to avoid removing admin edits
    names = [
        "L1 Prime Starter",
        "L2 Builder",
        "L3 Achiever",
        "L4 Champion",
        "L5 Captain",
        "L6 Master",
        "L7 Grand Master Leader",
        "L8 Leader",
        "L9 Crown Master",
        "L10 Legend",
    ]
    Rank.objects.filter(rank_name__in=names).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("mlm_ranks", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_ranks, reverse_code=unseed_ranks),
    ]

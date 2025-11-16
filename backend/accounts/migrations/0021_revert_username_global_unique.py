# Generated to restore global uniqueness of username and remove per-role constraint

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0020_alter_customuser_username_and_unique_per_role'),
    ]

    operations = [
        # Restore global unique on username (required by USERNAME_FIELD)
        migrations.AlterField(
            model_name='customuser',
            name='username',
            field=models.CharField(max_length=150, unique=True, db_index=True),
        ),
        # Drop the composite unique constraint as it's redundant with global unique
        migrations.RemoveConstraint(
            model_name='customuser',
            name='uniq_username_per_role',
        ),
    ]

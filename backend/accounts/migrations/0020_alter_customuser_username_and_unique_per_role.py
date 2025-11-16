# Generated manually to enforce (username, role) uniqueness and drop global username uniqueness

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0019_alter_customuser_category'),
    ]

    operations = [
        # Drop global unique on username and keep an index for lookups
        migrations.AlterField(
            model_name='customuser',
            name='username',
            field=models.CharField(max_length=150, unique=False, db_index=True),
        ),
        # Add composite unique constraint: username per role
        migrations.AddConstraint(
            model_name='customuser',
            constraint=models.UniqueConstraint(
                fields=['username', 'role'],
                name='uniq_username_per_role',
            ),
        ),
    ]

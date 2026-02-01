from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0032_alter_wallettransaction_type'),
    ]

    operations = [
        # Supports indexed filtering + ordered scans for agency assignable paths
        migrations.AddIndex(
            model_name='customuser',
            index=models.Index(fields=['registered_by', 'date_joined'], name='cu_regby_date_idx'),
        ),
        # Supports indexed filtering + ordered scans for pincode filters
        migrations.AddIndex(
            model_name='customuser',
            index=models.Index(fields=['pincode', 'date_joined'], name='cu_pin_date_idx'),
        ),
        # Supports role/category filters with ordered scans
        migrations.AddIndex(
            model_name='customuser',
            index=models.Index(fields=['role', 'category', 'date_joined'], name='cu_role_cat_date_idx'),
        ),
    ]

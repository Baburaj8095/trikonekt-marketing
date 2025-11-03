# Generated migration to extend CommissionConfig with geo distribution fields
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('business', '0002_commissionconfig_autopoolaccount'),
    ]

    operations = [
        migrations.AddField(
            model_name='commissionconfig',
            name='enable_geo_distribution',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='sub_franchise_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('15.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='pincode_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('4.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='pincode_coord_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('2.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='district_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='district_coord_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='state_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='state_coord_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('1.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='employee_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('2.00'), max_digits=5),
        ),
        migrations.AddField(
            model_name='commissionconfig',
            name='royalty_percent',
            field=models.DecimalField(decimal_places=2, default=Decimal('10.00'), max_digits=5),
        ),
    ]

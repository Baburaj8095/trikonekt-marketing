# Manual migration to add payment_method to PurchaseRequest
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('market', '0002_banner_banneritem'),
    ]

    operations = [
        migrations.AddField(
            model_name='purchaserequest',
            name='payment_method',
            field=models.CharField(choices=[('wallet', 'Wallet'), ('cash', 'Cash')], db_index=True, default='wallet', max_length=16),
        ),
    ]

from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('business', '0049_rename_business_pa_invoice_41138d_idx_business_pa_invoice_690d5d_idx_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='SPPGiftCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('season_number', models.PositiveIntegerField(db_index=True, default=1)),
                ('box_number', models.PositiveIntegerField(db_index=True, help_text='Month box 1 to 12')),
                ('amount', models.DecimalField(decimal_places=2, default=Decimal('1000.00'), max_digits=10)),
                ('coupon_code', models.CharField(db_index=True, max_length=64, unique=True)),
                ('qr_code_data', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('LOCKED', 'LOCKED'), ('ACTIVE', 'ACTIVE'), ('REDEEMED', 'REDEEMED'), ('MATURITY_ELIGIBLE', 'MATURITY_ELIGIBLE'), ('MATURED_PAID', 'MATURED_PAID'), ('CANCELLED', 'CANCELLED')], db_index=True, default='LOCKED', max_length=24)),
                ('purchased_at', models.DateTimeField(auto_now_add=True)),
                ('unlock_at', models.DateTimeField(help_text='purchased_at + 60 days')),
                ('expires_at', models.DateTimeField(help_text='unlock_at + 30 days')),
                ('redeemed_at', models.DateTimeField(blank=True, null=True)),
                ('redeemed_trip_id', models.CharField(blank=True, max_length=64)),
                ('redeemed_trip_name', models.CharField(blank=True, max_length=150)),
                ('payout_at', models.DateTimeField(blank=True, null=True)),
                ('payout_amount', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('purchase', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='spp_gift_cards', to='business.promopurchase')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='spp_gift_cards', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['season_number', 'box_number', '-id'],
                'indexes': [
                    models.Index(fields=['user', 'season_number', 'status'], name='business_sp_user_id_452b47_idx'),
                    models.Index(fields=['coupon_code'], name='business_sp_coupon__fa9d96_idx'),
                ],
            },
        ),
    ]

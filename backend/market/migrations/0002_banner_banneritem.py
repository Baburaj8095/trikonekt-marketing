# Generated manually for adding Banner and BannerItem models
from django.db import migrations, models
from django.conf import settings
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('market', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Banner',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('image', models.ImageField(blank=True, null=True, upload_to='products/banners/')),
                ('country', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('state', models.CharField(blank=True, db_index=True, default='', max_length=64)),
                ('city', models.CharField(blank=True, db_index=True, default='', max_length=128)),
                ('pincode', models.CharField(blank=True, db_index=True, default='', max_length=10)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='banners', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='BannerItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('price', models.DecimalField(decimal_places=2, max_digits=12)),
                ('quantity', models.PositiveIntegerField(default=0)),
                ('discount', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('coupon_redeem_percent', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('commission_pool_percent', models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('banner', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='market.banner')),
            ],
            options={
                'ordering': ['name'],
            },
        ),
        migrations.AddIndex(
            model_name='banneritem',
            index=models.Index(fields=['banner', 'name'], name='market_ban_banner__b6f3a7_idx'),
        ),
    ]

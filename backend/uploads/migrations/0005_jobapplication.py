from django.db import migrations, models
import django.db.models.deletion
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        ('uploads', '0004_dashboardcard_role'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='JobApplication',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('full_name', models.CharField(max_length=150)),
                ('email', models.EmailField(max_length=254)),
                ('phone', models.CharField(blank=True, max_length=20)),
                ('employment_type', models.CharField(choices=[('full_time', 'Full-time'), ('part_time', 'Part-time')], max_length=20)),
                ('resume', models.FileField(upload_to='uploads/resumes/')),
                ('address', models.TextField(blank=True)),
                ('city', models.CharField(blank=True, max_length=100)),
                ('state', models.CharField(blank=True, max_length=100)),
                ('pincode', models.CharField(blank=True, max_length=10)),
                ('experience_years', models.DecimalField(blank=True, decimal_places=1, max_digits=4, null=True)),
                ('skills', models.TextField(blank=True)),
                ('education', models.TextField(blank=True)),
                ('expected_salary', models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='job_applications', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]

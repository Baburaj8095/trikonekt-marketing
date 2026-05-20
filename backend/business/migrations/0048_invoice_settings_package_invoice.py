from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0047_teamconsumerdocument_business_pdf"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="InvoiceSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("company_name", models.CharField(default="Trikonekt", max_length=180)),
                ("gst_number", models.CharField(blank=True, default="", max_length=32)),
                ("company_address", models.TextField(blank=True, default="")),
                ("company_phone", models.CharField(blank=True, default="", max_length=32)),
                ("company_email", models.EmailField(blank=True, default="", max_length=254)),
                ("logo", models.ImageField(blank=True, null=True, upload_to="uploads/invoice/")),
                ("invoice_prefix", models.CharField(default="TRK/INV/", max_length=24)),
                ("gst_percent", models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ("footer_text", models.TextField(blank=True, default="Thank you for your purchase.")),
                ("is_active", models.BooleanField(db_index=True, default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["-is_active", "-updated_at", "-id"],
            },
        ),
        migrations.CreateModel(
            name="PackageInvoice",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("invoice_number", models.CharField(db_index=True, max_length=48, unique=True)),
                ("invoice_date", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("company_name", models.CharField(max_length=180)),
                ("company_gst_number", models.CharField(blank=True, default="", max_length=32)),
                ("company_address", models.TextField(blank=True, default="")),
                ("company_phone", models.CharField(blank=True, default="", max_length=32)),
                ("company_email", models.EmailField(blank=True, default="", max_length=254)),
                ("logo_url", models.CharField(blank=True, default="", max_length=500)),
                ("consumer_name", models.CharField(blank=True, default="", max_length=180)),
                ("consumer_phone", models.CharField(blank=True, default="", max_length=32)),
                ("consumer_username", models.CharField(blank=True, default="", max_length=180)),
                ("consumer_address", models.TextField(blank=True, default="")),
                ("consumer_city", models.CharField(blank=True, default="", max_length=120)),
                ("consumer_state", models.CharField(blank=True, default="", max_length=120)),
                ("consumer_pincode", models.CharField(blank=True, default="", max_length=20)),
                ("package_name", models.CharField(max_length=180)),
                ("package_code", models.CharField(blank=True, default="", max_length=80)),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("taxable_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("gst_percent", models.DecimalField(decimal_places=2, default=0, max_digits=5)),
                ("gst_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("total_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("payment_mode", models.CharField(blank=True, default="", max_length=32)),
                ("footer_text", models.TextField(blank=True, default="")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "promo_purchase",
                    models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="invoice", to="business.promopurchase"),
                ),
            ],
            options={
                "ordering": ["-invoice_date", "-id"],
            },
        ),
        migrations.AddIndex(
            model_name="packageinvoice",
            index=models.Index(fields=["invoice_date", "invoice_number"], name="business_pa_invoice_41138d_idx"),
        ),
    ]

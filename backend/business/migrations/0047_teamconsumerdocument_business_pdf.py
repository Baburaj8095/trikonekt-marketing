from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("business", "0046_state_only_promopurchase_payment_index_name"),
    ]

    operations = [
        migrations.AlterField(
            model_name="teamconsumerdocument",
            name="kind",
            field=models.CharField(
                choices=[
                    ("PDF", "Trikonekt PDF"),
                    ("BUSINESS_PDF", "Trikonekt Business PDF"),
                    ("CERTIFICATE", "Certificate"),
                ],
                db_index=True,
                max_length=24,
            ),
        ),
    ]

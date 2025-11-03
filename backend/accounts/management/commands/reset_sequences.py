from io import StringIO

from django.apps import apps
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
    help = "Reset primary key sequences for all apps. Run after loaddata to prevent duplicate key errors."

    def handle(self, *args, **options):
        app_labels = [app_config.label for app_config in apps.get_app_configs()]
        self.stdout.write("Collecting sqlsequencereset output for apps:")
        self.stdout.write(", ".join(sorted(app_labels)))

        buffer = StringIO()
        # Generate SQL to reset sequences for all apps' models
        call_command("sqlsequencereset", *app_labels, stdout=buffer)
        sql = buffer.getvalue().strip()

        if not sql:
            self.stdout.write(self.style.WARNING("No sequence reset SQL generated (nothing to reset)."))
            return

        statements = [s.strip() for s in sql.split(";") if s.strip()]
        self.stdout.write(f"Executing {len(statements)} SQL statements to reset sequences...")

        with transaction.atomic():
            with connection.cursor() as cursor:
                for stmt in statements:
                    # Print statement for visibility
                    self.stdout.write(f"- {stmt};")
                    cursor.execute(stmt)

        self.stdout.write(self.style.SUCCESS("Sequences reset successfully."))

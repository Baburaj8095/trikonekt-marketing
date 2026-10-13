from django.core.management.base import BaseCommand
from business.services.ssv_service import SSVService


class Command(BaseCommand):
    help = "Dispatches automated reminders for users whose SSV (Smart Product Package) Month 2 box is due (3 days, 1 day, and due today)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Simulate without creating notifications or emails")

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", False)
        self.stdout.write(f"Executing automated SSV due-date reminder task (dry_run={dry_run})...")
        res = SSVService.send_due_date_reminders(dry_run=dry_run)
        self.stdout.write(self.style.SUCCESS(
            f"Done! Processed {res['processed_users']} users. "
            f"Reminders -> 3 days: {res['reminders_3_days']}, 1 day: {res['reminders_1_day']}, "
            f"Due today: {res['reminders_due_today']}, Overdue: {res['overdue_count']}. "
            f"Dispatched: {res['dispatched_notifications']}."
        ))

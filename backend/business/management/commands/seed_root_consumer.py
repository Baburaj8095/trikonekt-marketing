from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.crypto import get_random_string

from accounts.models import CustomUser
from business.models import RootConsumerConfig


def _generate_unique_username(base: str) -> str:
    base = (base or "root_consumer").strip()
    uname = base
    i = 2
    while CustomUser.objects.filter(username=uname).exists():
        uname = f"{base}-{i}"
        i += 1
    return uname


class Command(BaseCommand):
    help = "Seed or set the single Root Consumer user.\n" \
           "Usage:\n" \
           "  python manage.py seed_root_consumer                        # create default 'root_consumer' if none exists\n" \
           "  python manage.py seed_root_consumer --username alice       # set existing consumer as root\n" \
           "  python manage.py seed_root_consumer --create-new --username root_consumer --email root@example.com  # create new consumer and set as root"

    def add_arguments(self, parser):
        parser.add_argument("--username", type=str, help="Existing or new username to set as Root Consumer")
        parser.add_argument("--email", type=str, help="Email to use when creating a new consumer (optional)")
        parser.add_argument("--create-new", action="store_true", help="Create a new consumer user if it does not exist")
        parser.add_argument("--force-convert", action="store_true", help="If the existing user is not a consumer, convert it into a consumer (use cautiously)")

    @transaction.atomic
    def handle(self, *args, **options):
        username = options.get("username")
        email = options.get("email")
        create_new = bool(options.get("create_new"))
        force_convert = bool(options.get("force_convert"))

        cfg = RootConsumerConfig.get_solo()
        current = cfg.get_root_user()
        if current:
            self.stdout.write(self.style.WARNING(f"Current Root Consumer is set to: {current.username} (id={current.id})"))

        user = None

        if username:
            # Resolve by username
            user = CustomUser.objects.filter(username=username).first()
            if user:
                # If converting is requested and user is not a consumer, convert it safely
                if (user.category != "consumer" or user.is_staff or user.is_superuser) and not force_convert:
                    raise CommandError("User exists but is not a consumer (or is staff/superuser). "
                                       "Run with --force-convert to convert it into a consumer.")
                if force_convert:
                    user.category = "consumer"
                    user.role = "user"
                    user.is_staff = False
                    user.is_superuser = False
                    user.account_active = True
                    user.save(update_fields=["category", "role", "is_staff", "is_superuser", "account_active"])
            elif create_new:
                # Create new consumer with the provided username
                uname = _generate_unique_username(username)
                pwd = get_random_string(12)
                user = CustomUser(
                    username=uname,
                    email=email or "",
                    role="user",
                    category="consumer",
                    is_staff=False,
                    is_superuser=False,
                    account_active=True,
                )
                user.set_password(pwd)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created new consumer: {user.username} (temporary password: {pwd})"))
            else:
                raise CommandError("Username not found. Use --create-new to create a new consumer user.")
        else:
            # No username provided: create default if nothing exists yet
            if not current:
                uname = _generate_unique_username("root_consumer")
                pwd = get_random_string(12)
                user = CustomUser(
                    username=uname,
                    email=email or "",
                    role="user",
                    category="consumer",
                    is_staff=False,
                    is_superuser=False,
                    account_active=True,
                )
                user.set_password(pwd)
                user.save()
                self.stdout.write(self.style.SUCCESS(f"Created default consumer: {user.username} (temporary password: {pwd})"))
            else:
                # Keep the current root user
                user = current

        # Finalize config
        if not user:
            raise CommandError("Failed to resolve or create the root consumer user.")

        cfg.root_user = user
        cfg.save(update_fields=["root_user", "updated_at"])
        self.stdout.write(self.style.SUCCESS(f"Root Consumer set to: {user.username} (id={user.id})"))

from django.core.management.base import BaseCommand
from django.core.mail import send_mail, EmailMessage
from django.conf import settings
import sys


class Command(BaseCommand):
    help = "Welcome to Trikonekt"

    def add_arguments(self, parser):
        parser.add_argument(
            "--to",
            dest="to",
            help="Recipient email address (required)",
            required=True,
        )
        parser.add_argument(
            "--subject",
            dest="subject",
            default="Trikonekt SMTP test",
            help="Email subject",
        )
        parser.add_argument(
            "--message",
            dest="message",
            default=(
                "Hello,\n\n"
                "This is a test email sent via Django using the configured SMTP settings.\n\n"
                "If you received this, SMTP is configured correctly.\n\n"
                "— Trikonekt"
            ),
            help="Plain text message body",
        )
        parser.add_argument(
            "--html",
            dest="html",
            action="store_true",
            help="Send as HTML email (uses EmailMessage)",
        )
        parser.add_argument(
            "--verbose-config",
            dest="verbose_config",
            action="store_true",
            help="Print effective email settings before sending",
        )

    def handle(self, *args, **options):
        to = options["to"]
        subject = options["subject"]
        message = options["message"]
        html = options["html"]
        verbose = options["verbose_config"]

        # Compute from_email
        from_email = getattr(settings, "DEFAULT_FROM_EMAIL", None) or getattr(settings, "EMAIL_HOST_USER", None)

        if verbose:
            self.stdout.write(self.style.MIGRATE_HEADING("Effective email settings:"))
            self.stdout.write(f"  MAIL_ENABLED: {getattr(settings, 'MAIL_ENABLED', None)}")
            self.stdout.write(f"  EMAIL_BACKEND: {getattr(settings, 'EMAIL_BACKEND', None)}")
            self.stdout.write(f"  EMAIL_HOST: {getattr(settings, 'EMAIL_HOST', None)}")
            self.stdout.write(f"  EMAIL_PORT: {getattr(settings, 'EMAIL_PORT', None)}")
            self.stdout.write(f"  EMAIL_USE_TLS: {getattr(settings, 'EMAIL_USE_TLS', None)}")
            self.stdout.write(f"  EMAIL_USE_SSL: {getattr(settings, 'EMAIL_USE_SSL', None)}")
            self.stdout.write(f"  EMAIL_HOST_USER (from): {getattr(settings, 'EMAIL_HOST_USER', None)}")
            self.stdout.write(f"  DEFAULT_FROM_EMAIL: {getattr(settings, 'DEFAULT_FROM_EMAIL', None)}")
            self.stdout.write(f"  SERVER_EMAIL: {getattr(settings, 'SERVER_EMAIL', None)}")
            self.stdout.write("")

        try:
            if html:
                email = EmailMessage(
                    subject=subject,
                    body=message if "<" in message or "<" in message else f"<pre>{message}</pre>",
                    from_email=from_email,
                    to=[to],
                )
                email.content_subtype = "html"
                email.send(fail_silently=False)
            else:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=from_email,
                    recipient_list=[to],
                    fail_silently=False,
                )
        except Exception as e:
            self.stderr.write(self.style.ERROR(f"❌ Failed to send test email: {e}"))
            self.stderr.write("Troubleshooting tips:")
            self.stderr.write(" - Verify MAIL_ENABLED=True and SMTP credentials in backend/.env")
            self.stderr.write(" - For Zoho: use smtp.zoho.in:587 with EMAIL_USE_TLS=True (not SSL)")
            self.stderr.write(" - Ensure DEFAULT_FROM_EMAIL or EMAIL_HOST_USER is a verified sender")
            self.stderr.write(" - Restart the server after changing backend/.env")
            self.stderr.write(" - Check spam/junk folder; configure SPF/DKIM/DMARC for your domain")
            sys.exit(1)

        self.stdout.write(self.style.SUCCESS(f"✅ Test email sent successfully to {to}"))

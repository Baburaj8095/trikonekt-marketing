from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from accounts.models import CustomUser


def _only_digits(s: str) -> str:
    return "".join(c for c in (s or "") if c.isdigit())


def resolve_user_by_identifier(s: str) -> CustomUser | None:
    """
    Resolve a user by a flexible identifier:
    - prefixed_id (TR-XXXXXXXXXX)
    - username
    - unique_id (6 digits)
    - phone (digits)
    - TR-without-dash and TR-with-dash variants
    """
    sval = (s or "").strip()
    if not sval:
        return None
    digs = _only_digits(sval)

    # 1) Exact prefixed_id / username / unique_id
    q = Q(prefixed_id__iexact=sval) | Q(username__iexact=sval) | Q(unique_id__iexact=sval)
    # 2) Digits fallback: phone or username digits-only
    if digs:
        q = q | Q(phone__iexact=digs) | Q(username__iexact=digs)

    # 3) TR-without/with-dash variants (e.g., TR1234567890 & TR-1234567890)
    if len(sval) > 2 and sval[:2].isalpha():
        if "-" in sval:
            nodash = sval.replace("-", "", 1)
            q = q | Q(prefixed_id__iexact=nodash) | Q(username__iexact=nodash)
        else:
            withdash = f"{sval[:2]}-{sval[2:]}"
            q = q | Q(prefixed_id__iexact=withdash) | Q(username__iexact=withdash)

    return CustomUser.objects.filter(q).only("id", "username", "prefixed_id", "phone").first()


class Command(BaseCommand):
    help = (
        "Repair missing directs when a sponsor's phone changed. "
        "Sets registered_by for legacy children where sponsor_id equals the OLD phone. "
        "Also normalizes child.sponsor_id to the sponsor's prefixed_id."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--sponsor",
            required=True,
            help="Sponsor identifier (prefixed_id/username/unique_id/phone) for the CURRENT sponsor user.",
        )
        parser.add_argument(
            "--old-phone",
            required=True,
            help="Old phone number (digits) that was previously used as sponsor_id on children.",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes. If omitted, runs in dry-run mode and prints what would change.",
        )

    def handle(self, *args, **options):
        sponsor_ident = str(options["sponsor"] or "").strip()
        old_phone_in = str(options["old_phone"] or "").strip()
        do_apply = bool(options.get("apply"))

        if not sponsor_ident:
            raise CommandError("Missing --sponsor")
        if not old_phone_in:
            raise CommandError("Missing --old-phone")

        sponsor = resolve_user_by_identifier(sponsor_ident)
        if not sponsor:
            raise CommandError(f"Sponsor '{sponsor_ident}' not found.")

        old_digits = _only_digits(old_phone_in)
        if not old_digits:
            raise CommandError("--old-phone must contain digits")

        self.stdout.write(self.style.NOTICE(f"Resolved sponsor: id={sponsor.id} username={sponsor.username} prefixed_id={sponsor.prefixed_id} phone={sponsor.phone}"))

        # Target legacy children whose registered_by is NULL and sponsor_id equals the OLD phone (with or without formatting)
        qs = (
            CustomUser.objects
            .filter(registered_by__isnull=True)
            .filter(Q(sponsor_id__iexact=old_phone_in) | Q(sponsor_id__iexact=old_digits))
        )

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No legacy children found with sponsor_id matching the provided old phone. Nothing to do."))
            return

        # Preview list (first 25)
        preview = list(qs.values("id", "username", "sponsor_id")[:25])
        self.stdout.write(self.style.NOTICE(f"Found {total} legacy children to fix. Showing first {len(preview)}:"))
        for r in preview:
            self.stdout.write(f"- id={r['id']} username={r['username']} sponsor_id={r['sponsor_id']}")

        if not do_apply:
            self.stdout.write(self.style.SUCCESS("Dry-run complete. Re-run with --apply to perform updates."))
            return

        # Apply updates
        new_sid = sponsor.prefixed_id or sponsor.username
        updated = qs.update(registered_by_id=sponsor.id, sponsor_id=new_sid)
        self.stdout.write(self.style.SUCCESS(f"Updated {updated} rows: set registered_by={sponsor.id}, sponsor_id='{new_sid}'"))

        # Optional: sanity check counts after update
        fixed_cnt = CustomUser.objects.filter(registered_by_id=sponsor.id, sponsor_id=new_sid).count()
        self.stdout.write(self.style.SUCCESS(f"Post-check: children now linked via registered_by: {fixed_cnt} (across all match keys)"))

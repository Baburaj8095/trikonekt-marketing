from django.core.management.base import BaseCommand
from django.db.models import Q
from django.db import transaction
from decimal import Decimal

from accounts.models import CustomUser, Wallet, WalletTransaction
from business.models import CommissionConfig


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


class Command(BaseCommand):
    help = (
        "Fix a user's registered_by based on a sponsor code/username and credit the missing DIRECT_REF_BONUS (₹15 by default).\n"
        "Idempotent: only updates when needed and only credits if a matching DIRECT_REF_BONUS does not already exist."
    )

    def add_arguments(self, parser):
        parser.add_argument("--user", required=True, help="Target user: username or 10-digit phone")
        parser.add_argument("--sponsor", required=False, default="", help="Sponsor code/username (e.g., TREMP0000000001 or TREMP-0000000001). If omitted, tries user.sponsor_id.")
        parser.add_argument("--dry-run", action="store_true", help="Simulate only, do not write changes.")

    def _resolve_user(self, token: str) -> CustomUser | None:
        t = (token or "").strip()
        if not t:
            return None
        digits = "".join(c for c in t if c.isdigit())
        qs = CustomUser.objects.all()
        u = qs.filter(username__iexact=t).first()
        if u:
            return u
        if digits:
            u = qs.filter(Q(phone__iexact=digits) | Q(username__iexact=digits)).first()
        return u

    def _resolve_sponsor(self, raw: str) -> CustomUser | None:
        val = (raw or "").strip()
        if not val:
            return None
        qs = CustomUser.objects.all()
        # direct exact matches
        u = qs.filter(Q(prefixed_id__iexact=val) | Q(username__iexact=val) | Q(sponsor_id__iexact=val)).first()
        if u:
            return u
        # hyphen normalization: PREFIX0000000001 -> PREFIX-0000000001
        import re
        m = re.match(r"^([A-Za-z_]+)-?(\d{10})$", val)
        if m:
            hyphenated = f"{m.group(1).upper()}-{m.group(2)}"
            u = qs.filter(Q(prefixed_id__iexact=hyphenated) | Q(username__iexact=hyphenated) | Q(sponsor_id__iexact=hyphenated)).first()
            if u:
                return u
        # phone digits fallback
        digits = "".join(c for c in val if c.isdigit())
        if digits:
            u = qs.filter(Q(phone__iexact=digits) | Q(username__iexact=digits)).first()
            if u:
                return u
        return None

    @transaction.atomic
    def handle(self, *args, **options):
        token_user = options.get("user")
        sponsor_token = options.get("sponsor") or ""
        dry = bool(options.get("dry_run"))

        target = self._resolve_user(token_user)
        if not target:
            self.stdout.write(self.style.ERROR(f"User not found for token: {token_user}"))
            return

        sponsor_val = sponsor_token or (target.sponsor_id or "")
        sponsor = self._resolve_sponsor(sponsor_val)
        if not sponsor:
            self.stdout.write(self.style.ERROR(f"Sponsor not found. Provided='{sponsor_token}', user.sponsor_id='{target.sponsor_id}'"))
            return

        self.stdout.write(f"Target user: {target.username} (id={target.id})")
        self.stdout.write(f"Sponsor: {sponsor.username} (id={sponsor.id}, prefixed_id={getattr(sponsor, 'prefixed_id', '')})")

        updated_rb = False
        if getattr(target, "registered_by_id", None) != sponsor.id:
            if dry:
                self.stdout.write(f"[DRY-RUN] Would set registered_by for {target.username} -> {sponsor.username}")
            else:
                target.registered_by = sponsor
                # also align the user's sponsor_id to sponsor's code if available
                try:
                    sponsor_code = getattr(sponsor, "prefixed_id", "") or getattr(sponsor, "username", "")
                    if sponsor_code:
                        target.sponsor_id = sponsor_code
                except Exception:
                    pass
                target.save(update_fields=["registered_by", "sponsor_id"])
            updated_rb = True
        else:
            self.stdout.write("registered_by is already set to the sponsor; no change.")

        # Credit DIRECT_REF_BONUS if missing
        exists = WalletTransaction.objects.filter(
            user=sponsor,
            type="DIRECT_REF_BONUS",
            source_type="JOIN_REFERRAL",
            source_id=str(target.id),
        ).exists()

        if exists:
            self.stdout.write(self.style.NOTICE("DIRECT_REF_BONUS already exists for this referral. No credit needed."))
            return

        cfg = CommissionConfig.get_solo()
        try:
            fixed = getattr(cfg, "referral_join_fixed_json", {}) or {}
        except Exception:
            fixed = {}
        amt = _q2(fixed.get("direct", 15))

        if amt <= 0:
            self.stdout.write(self.style.WARNING(f"Configured direct referral amount is {amt}. Skipping credit."))
            return

        if dry:
            self.stdout.write(f"[DRY-RUN] Would credit sponsor={sponsor.username} +₹{amt} for new_user={target.username} ({target.id})")
            return

        try:
            w = Wallet.get_or_create_for_user(sponsor)
            w.credit(
                amt,
                tx_type="DIRECT_REF_BONUS",
                meta={
                    "source": "JOIN_REFERRAL",
                    "from_user_id": target.id,
                    "from_user": target.username,
                    "fix": True,
                },
                source_type="JOIN_REFERRAL",
                source_id=str(target.id),
            )
            self.stdout.write(self.style.SUCCESS(
                f"Credited sponsor={sponsor.username} +₹{amt} for new_user={target.username} ({target.id})"
            ))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Failed to credit DIRECT_REF_BONUS: {e}"))

        if updated_rb and not dry:
            self.stdout.write(self.style.SUCCESS("registered_by updated successfully."))

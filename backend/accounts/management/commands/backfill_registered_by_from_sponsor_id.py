from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q
from accounts.models import CustomUser


def _only_digits(s: str) -> str:
    return "".join(ch for ch in (s or "") if ch.isdigit())


def resolve_sponsor_user(token: str) -> CustomUser | None:
    """
    Resolve a sponsor user from a flexible token:
    - Exact match on prefixed_id / username
    - TR-with-dash and TR-without-dash variants
    - unique_id (6 digits)
    - phone (digits)
    - username digits-only (legacy)
    """
    s = (token or "").strip()
    if not s:
        return None
    digits = _only_digits(s)

    # 1) Exact prefixed_id/username
    u = CustomUser.objects.filter(Q(prefixed_id__iexact=s) | Q(username__iexact=s)).only("id").first()
    if u:
        return u

    # 2) Try adding/removing dash after prefix for TR-like codes
    try:
        if len(s) > 2 and s[:2].isalpha():
            if "-" not in s:
                withdash = f"{s[:2]}-{s[2:]}"
                u = CustomUser.objects.filter(Q(prefixed_id__iexact=withdash) | Q(username__iexact=withdash)).only("id").first()
                if u:
                    return u
            else:
                nodash = s.replace("-", "", 1)
                u = CustomUser.objects.filter(Q(prefixed_id__iexact=nodash) | Q(username__iexact=nodash)).only("id").first()
                if u:
                    return u
    except Exception:
        pass

    # 3) unique_id (6 digits) exact
    if digits and len(digits) == 6:
        u = CustomUser.objects.filter(unique_id__iexact=digits).only("id").first()
        if u:
            return u

    # 4) Digits-only fallback: prefer TR+digits variants first, else phone and username digits
    if digits:
        pref = (getattr(CustomUser, "PREFIX_MAP", {}) or {}).get("consumer", "TR")
        tr_variants = [f"{pref}{digits}", f"{pref}-{digits}"]
        u = CustomUser.objects.filter(
            Q(prefixed_id__iexact=tr_variants[0])
            | Q(prefixed_id__iexact=tr_variants[1])
            | Q(username__iexact=tr_variants[0])
            | Q(username__iexact=tr_variants[1])
        ).only("id").first()
        if u:
            return u
        # Phone
        u = CustomUser.objects.filter(phone__iexact=digits).only("id").first()
        if u:
            return u
        # Username digits-only (legacy)
        u = CustomUser.objects.filter(username__iexact=digits).only("id").first()
        if u:
            return u

    # 5) Last resort: exact username (case-insensitive)
    return CustomUser.objects.filter(username__iexact=s).only("id").first()


class Command(BaseCommand):
    help = (
        "Backfill registered_by for users that only have legacy sponsor_id linkage.\n"
        "- Resolves sponsor_id to a real user using robust matching (prefixed_id/username/unique_id/phone/TR variants).\n"
        "- Sets child.registered_by to that sponsor and normalizes child.sponsor_id to sponsor.prefixed_id.\n"
        "Use --dry-run (default) to preview, and --apply to commit."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--match",
            default="",
            help="Optional exact sponsor_id token to match (e.g., an old phone like 9611443183). "
                 "If provided, restricts processing to children with sponsor_id equal to this (or its digits).",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Optional max rows to process (0 = no limit).",
        )
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Apply changes. If omitted, runs in dry-run mode.",
        )

    def handle(self, *args, **opts):
        token = (opts.get("match") or "").strip()
        limit = int(opts.get("limit") or 0)
        do_apply = bool(opts.get("apply"))

        base_qs = CustomUser.objects.filter(registered_by__isnull=True).exclude(sponsor_id__exact="")
        if token:
            digs = _only_digits(token)
            cond = Q(sponsor_id__iexact=token)
            if digs:
                cond = cond | Q(sponsor_id__iexact=digs)
            base_qs = base_qs.filter(cond)

        total = base_qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No legacy rows found to backfill."))
            return

        if limit and total > limit:
            self.stdout.write(self.style.NOTICE(f"Found {total} rows; limiting to first {limit}."))
        else:
            self.stdout.write(self.style.NOTICE(f"Found {total} rows to evaluate."))

        qs_iter = base_qs.order_by("id").iterator(chunk_size=500)
        processed = 0
        fixed = 0
        preview_cap = 25
        preview = []

        @transaction.atomic
        def apply_fix(child: CustomUser, sponsor: CustomUser):
            # Re-fetch with FOR UPDATE to serialize concurrent writes on this child
            c = CustomUser.objects.select_for_update().only("id", "registered_by_id", "sponsor_id").get(pk=child.pk)
            if getattr(c, "registered_by_id", None):
                return False
            new_sid = (getattr(sponsor, "prefixed_id", None) or getattr(sponsor, "username", "") or "").strip()
            # Avoid self-link or invalid sponsor
            if sponsor.id == c.id or not new_sid:
                return False
            c.registered_by_id = sponsor.id
            c.sponsor_id = new_sid
            c.save(update_fields=["registered_by_id", "sponsor_id"])
            return True

        for child in qs_iter:
            if limit and processed >= limit:
                break
            processed += 1

            sid = (getattr(child, "sponsor_id", "") or "").strip()
            sponsor = resolve_sponsor_user(sid)
            if not sponsor or sponsor.id == child.id:
                # Could not resolve or invalid
                if len(preview) < preview_cap:
                    preview.append({"id": child.id, "username": child.username, "sponsor_id": sid, "action": "SKIP_UNRESOLVED"})
                continue

            if len(preview) < preview_cap:
                preview.append({
                    "id": child.id,
                    "username": child.username,
                    "sponsor_id": sid,
                    "resolved_sponsor_id": sponsor.id,
                    "resolved_sponsor_username": sponsor.username,
                    "normalize_to": (getattr(sponsor, "prefixed_id", None) or sponsor.username),
                })

            if do_apply:
                try:
                    changed = apply_fix(child, sponsor)
                    if changed:
                        fixed += 1
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f"Failed to update child id={child.id} ({child.username}): {e}"))

        # Report
        mode = "APPLY" if do_apply else "DRY-RUN"
        self.stdout.write(self.style.NOTICE(f"[{mode}] Evaluated={processed}, Fixed={fixed}"))
        self.stdout.write(self.style.NOTICE(f"Preview ({len(preview)} rows):"))
        for row in preview:
            self.stdout.write(f"- {row}")

        if not do_apply:
            self.stdout.write(self.style.SUCCESS("Dry-run complete. Re-run with --apply to commit changes."))
        else:
            self.stdout.write(self.style.SUCCESS("Apply complete."))

from __future__ import annotations

from typing import List
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import datetime


class Command(BaseCommand):
    help = "Attempt to create missing FIVE_150 AutoPoolAccount entries for specified users"

    def add_arguments(self, parser):
        parser.add_argument(
            "--ids",
            type=str,
            required=True,
            help="Comma-separated list of user ids or usernames to retry (e.g. 123,alice)",
        )
        parser.add_argument(
            "--source-type",
            type=str,
            default="RETRY_PLACEMENT",
            help="Source type to use when creating the AutoPoolAccount (default: RETRY_PLACEMENT)",
        )
        parser.add_argument(
            "--source-id",
            type=str,
            default=None,
            help="Optional source id to attach to created AutoPoolAccount (default: timestamp)",
        )
        parser.add_argument(
            "--start-entry-id",
            type=int,
            default=None,
            help="Optional start AutoPoolAccount id to anchor placement (sponsor subtree).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Do not create accounts; only report what would be done",
        )

    def handle(self, *args, **options):
        ids_raw: str = str(options.get("ids") or "")
        tokens: List[str] = [t.strip() for t in ids_raw.split(",") if t.strip()]
        src_type: str = str(options.get("source_type") or "RETRY_PLACEMENT")
        src_id_opt: str | None = options.get("source_id")
        dry_run: bool = bool(options.get("dry_run"))

        try:
            from accounts.models import CustomUser
        except Exception:
            self.stderr.write("Could not import CustomUser; aborting")
            return
        try:
            from business.models import AutoPoolAccount, CommissionConfig
            # Optional: AuditTrail for logging retry attempts
            try:
                from coupons.models import AuditTrail
            except Exception:
                AuditTrail = None
        except Exception:
            self.stderr.write("Could not import business models; aborting")
            return

        # Resolve timestamp-based default source_id
        if not src_id_opt:
            src_id_opt = datetime.utcnow().isoformat(timespec="seconds")

        def resolve_user(token: str):
            try:
                uid = int(token)
                u = CustomUser.objects.filter(id=uid).first()
                if u:
                    return u
            except Exception:
                pass
            try:
                u = CustomUser.objects.filter(username=token).first()
                if u:
                    return u
            except Exception:
                pass
            return None

        cfg = CommissionConfig.get_solo()
        default_amount = getattr(cfg, "prime_activation_amount", 150)

        results = []
        for tok in tokens:
            u = resolve_user(tok)
            if not u:
                self.stderr.write(f"Could not resolve user: {tok}")
                continue
            # Check existing FIVE_150 for this source
            exists = AutoPoolAccount.objects.filter(owner=u, pool_type="FIVE_150", source_type=str(src_type), source_id=str(src_id_opt)).exists()
            any_five = AutoPoolAccount.objects.filter(owner=u, pool_type="FIVE_150").exists()
            if exists:
                self.stdout.write(f"SKIP (already exists): user={u.id} identifier={getattr(u,'username',None)}")
                results.append((u.id, "exists", None))
                continue

            if dry_run:
                self.stdout.write(f"DRY-RUN would create FIVE_150 for user={u.id} any_five={int(any_five)} start_entry_id={options.get('start_entry_id')}")
                results.append((u.id, "dry-run", None))
                continue

            try:
                # Record retry attempt audit
                try:
                    if AuditTrail is not None:
                        AuditTrail.objects.create(
                            action="retry_five_150_attempt",
                            actor=None,
                            notes=f"retry for user {u.id}",
                            metadata={
                                "request_source_type": str(src_type),
                                "request_source_id": str(src_id_opt),
                                "start_entry_id": options.get("start_entry_id"),
                            },
                        )
                except Exception:
                    pass

                acc = AutoPoolAccount.create_five_150_for_user(
                    u,
                    amount=default_amount,
                    source_type=str(src_type),
                    source_id=str(src_id_opt),
                    start_entry_id=options.get("start_entry_id"),
                )
                if acc:
                    self.stdout.write(f"CREATED: user={u.id} account_id={acc.id} level={acc.level} position={acc.position}")
                    results.append((u.id, "created", getattr(acc, "id", None)))
                    try:
                        if AuditTrail is not None:
                            AuditTrail.objects.create(
                                action="retry_five_150_created",
                                actor=None,
                                notes=f"created account {acc.id} for user {u.id}",
                                metadata={
                                    "account_id": acc.id,
                                    "pool_type": getattr(acc, "pool_type", None),
                                    "level": getattr(acc, "level", None),
                                    "position": getattr(acc, "position", None),
                                },
                            )
                    except Exception:
                        pass
                else:
                    self.stderr.write(f"UNKNOWN failure creating for user={u.id}")
                    results.append((u.id, "unknown", None))
            except Exception as e:
                self.stderr.write(f"ERROR creating for user={u.id}: {e}")
                try:
                    if AuditTrail is not None:
                        AuditTrail.objects.create(
                            action="retry_five_150_failed",
                            actor=None,
                            notes=str(e),
                            metadata={"user_id": u.id, "start_entry_id": options.get("start_entry_id")},
                        )
                except Exception:
                    pass
                results.append((u.id, "error", str(e)))

        self.stdout.write(f"\nSummary rows: {len(results)}")

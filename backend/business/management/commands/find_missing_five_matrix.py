from __future__ import annotations

from typing import List
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = "Find users in last N days whose purchase transactions did not result in a FIVE_150 AutoPoolAccount"

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=15, help="Lookback window in days (default: 15)")
        parser.add_argument(
            "--source-types",
            type=str,
            default=",".join(["PRIME_150", "PRIME_750", "PRIME_759", "MONTHLY_759"]),
            help="Comma-separated source_type values to inspect (default: PRIME_150,PRIME_750,PRIME_759,MONTHLY_759)",
        )
        parser.add_argument(
            "--outfile",
            type=str,
            default=None,
            help="Optional path to write CSV of impacted unique users",
        )

    def handle(self, *args, **options):
        days: int = int(options.get("days") or 15)
        srcs_raw: str = str(options.get("source_types") or "")
        source_types: List[str] = [s.strip() for s in srcs_raw.split(",") if s.strip()]

        cutoff = timezone.now() - timedelta(days=days)

        # Local imports to avoid startup cost / circular imports
        try:
            from accounts.models import WalletTransaction as WT
        except Exception:
            self.stderr.write("Could not import WalletTransaction from accounts.models; aborting")
            return
        try:
            from business.models import AutoPoolAccount
        except Exception:
            self.stderr.write("Could not import AutoPoolAccount from business.models; aborting")
            return

        qs = WT.objects.filter(created_at__gte=cutoff, source_type__in=source_types).order_by("created_at")

        seen_users = set()
        impacted = []

        for tx in qs.iterator():
            uid = getattr(tx, "user_id", None)
            st = getattr(tx, "source_type", None)
            sid = str(getattr(tx, "source_id", "") or "")
            if uid is None:
                continue

            # Skip users already reported
            key = (uid, st, sid)
            if key in seen_users:
                continue
            seen_users.add(key)

            # Does a FIVE_150 account exist for this owner+source?
            has = AutoPoolAccount.objects.filter(owner_id=uid, pool_type="FIVE_150").filter(
                source_type=str(st or ""), source_id=str(sid)
            ).exists()

            if not has:
                # Also check if user has any FIVE_150 at all (maybe created earlier)
                any_five = AutoPoolAccount.objects.filter(owner_id=uid, pool_type="FIVE_150").exists()
                impacted.append({
                    "user_id": uid,
                    "tx_id": getattr(tx, "id", None),
                    "tx_created_at": getattr(tx, "created_at", None),
                    "source_type": st,
                    "source_id": sid,
                    "has_any_five": any_five,
                })

        # Aggregate unique users (keep first example tx per user)
        if not impacted:
            self.stdout.write(f"No impacted users found in the last {days} days for source_types={source_types}")
            return

        unique = {}
        for row in impacted:
            uid = row["user_id"]
            if uid not in unique:
                unique[uid] = {
                    "user_id": uid,
                    "first_tx_id": row.get("tx_id"),
                    "first_tx_created_at": row.get("tx_created_at"),
                    "sample_source_type": row.get("source_type"),
                    "sample_source_id": row.get("source_id"),
                    "has_any_five": row.get("has_any_five"),
                    "missing_count": 1,
                }
            else:
                unique[uid]["missing_count"] += 1

        # Write CSV to stdout or file
        out_lines = ["user_id,first_tx_id,first_tx_created_at,sample_source_type,sample_source_id,has_any_five,missing_count"]
        for uid, row in unique.items():
            out_lines.append(
                f"{row['user_id']},{row['first_tx_id']},{row['first_tx_created_at']},{row['sample_source_type']},{row['sample_source_id']},{int(bool(row['has_any_five']))},{row['missing_count']}"
            )

        outfile = options.get("outfile")
        if outfile:
            try:
                with open(outfile, "w", encoding="utf-8") as fh:
                    fh.write("\n".join(out_lines))
                self.stdout.write(f"Wrote {len(unique)} unique impacted users to {outfile}")
            except Exception as e:
                self.stderr.write(f"Failed to write outfile {outfile}: {e}")
                self.stdout.write("\n".join(out_lines))
        else:
            for l in out_lines:
                self.stdout.write(l)
            self.stdout.write(f"\nTotal unique impacted users: {len(unique)} (rows checked: {len(impacted)})")

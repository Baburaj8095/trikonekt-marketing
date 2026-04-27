from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, Optional, Tuple

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import WalletTransaction
from business.models import AutoPoolAccount


@dataclass(frozen=True)
class _TxPoolInfo:
    pool: str
    tx_type: str


def _pool_for_tx(tx: WalletTransaction) -> Optional[_TxPoolInfo]:
    t = str(getattr(tx, "type", "") or "").strip().upper()
    if t == "AUTOPOOL_BONUS_FIVE":
        return _TxPoolInfo(pool="FIVE_150", tx_type="AUTOPOOL_BONUS_FIVE")
    if t == "AUTOPOOL_BONUS_THREE":
        return _TxPoolInfo(pool="THREE_150", tx_type="AUTOPOOL_BONUS_THREE")

    # Streaming split credits
    if t in {"INCOME_CREDIT_75", "SELF_ACCOUNT_CREDIT"}:
        meta = getattr(tx, "meta", None) or {}
        orig = str((meta or {}).get("orig_type") or "").strip().upper()
        if orig == "AUTOPOOL_BONUS_FIVE":
            return _TxPoolInfo(pool="FIVE_150", tx_type=orig)
        if orig == "AUTOPOOL_BONUS_THREE":
            return _TxPoolInfo(pool="THREE_150", tx_type=orig)

    return None


def _tx_source(tx: WalletTransaction) -> Tuple[str, str]:
    st = str(getattr(tx, "source_type", "") or "").strip()
    sid = str(getattr(tx, "source_id", "") or "").strip()
    if st and sid:
        return st, sid

    meta = getattr(tx, "meta", None) or {}
    st2 = str((meta or {}).get("source_type") or "").strip()
    sid2 = str((meta or {}).get("source_id") or "").strip()
    return st2, sid2


def _find_trigger_account(pool: str, source_type: str, source_id: str) -> Optional[AutoPoolAccount]:
    if not (pool and source_type and source_id):
        return None
    # Prefer ACTIVE (most likely current tree), but allow CLOSED/PENDING fallback.
    qs = AutoPoolAccount.objects.filter(
        pool_type=pool,
        source_type__iexact=str(source_type),
        source_id=str(source_id),
    ).only("id", "owner_id", "parent_account_id", "source_type", "source_id", "pool_type")

    acc = qs.filter(status="ACTIVE").order_by("-created_at", "-id").first()
    if acc:
        return acc
    return qs.order_by("-created_at", "-id").first()


def _paid_seat_for_user(trigger: AutoPoolAccount, user_id: int) -> Optional[AutoPoolAccount]:
    """Reconstruct the paid seat node for a given credited user.

    Walk ancestors of the *trigger seat* and pick the first ancestor whose owner is user_id,
    while de-duplicating owners (matching payout engine behavior).
    """
    try:
        seen_owner_ids = set()
        node = getattr(trigger, "parent_account", None)
        while node:
            oid = int(getattr(node, "owner_id", 0) or 0)
            if oid and oid not in seen_owner_ids:
                if oid == int(user_id or 0):
                    return node
                seen_owner_ids.add(oid)
            node = getattr(node, "parent_account", None)
    except Exception:
        return None
    return None


def _matrix_root_payload(pool: str, seat: AutoPoolAccount) -> Dict[str, Any]:
    return {
        "pool": str(pool or ""),
        "account_id": int(getattr(seat, "id", 0) or 0),
        "entry_index": int(getattr(seat, "user_entry_index", 0) or 0),
        "source_type": str(getattr(seat, "source_type", "") or "").strip().upper(),
        "source_id": str(getattr(seat, "source_id", "") or "").strip(),
        "owner_id": int(getattr(seat, "owner_id", 0) or 0),
    }


class Command(BaseCommand):
    help = "Backfill WalletTransaction.meta.matrix_root for existing matrix credits (AUTOPOOL_BONUS_* and split credits)."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=None, help="Only process this credited user id")
        parser.add_argument("--pool", type=str, default="", help="Filter by pool: FIVE_150 | THREE_150")
        parser.add_argument("--limit", type=int, default=0, help="Max transactions to process (0 = no limit)")
        parser.add_argument("--dry-run", action="store_true", help="Do not write changes")
        parser.add_argument("--force", action="store_true", help="Overwrite existing meta.matrix_root")

    @transaction.atomic
    def handle(self, *args, **opts):
        user_id = opts.get("user_id")
        pool_filter = str(opts.get("pool") or "").strip().upper()
        limit = int(opts.get("limit") or 0)
        dry_run = bool(opts.get("dry_run"))
        force = bool(opts.get("force"))

        qs = WalletTransaction.objects.filter(amount__gt=0).order_by("created_at", "id")
        if user_id:
            qs = qs.filter(user_id=int(user_id))

        # Matrix credit rows and split rows only
        qs = qs.filter(
            type__in=(
                "AUTOPOOL_BONUS_FIVE",
                "AUTOPOOL_BONUS_THREE",
                "INCOME_CREDIT_75",
                "SELF_ACCOUNT_CREDIT",
            )
        )

        if limit > 0:
            qs = qs[:limit]

        processed = 0
        updated = 0
        skipped_no_source = 0
        skipped_no_trigger = 0
        skipped_no_match = 0
        skipped_has_meta = 0

        for tx in qs.iterator(chunk_size=500):
            processed += 1

            info = _pool_for_tx(tx)
            if not info:
                continue
            if pool_filter and info.pool != pool_filter:
                continue

            meta = getattr(tx, "meta", None) or {}
            if not force and (meta or {}).get("matrix_root"):
                skipped_has_meta += 1
                continue

            st, sid = _tx_source(tx)
            if not (st and sid):
                skipped_no_source += 1
                continue

            trigger = _find_trigger_account(info.pool, st, sid)
            if not trigger:
                skipped_no_trigger += 1
                continue

            seat = _paid_seat_for_user(trigger, user_id=int(getattr(tx, "user_id", 0) or 0))
            if not seat:
                skipped_no_match += 1
                continue

            meta2 = dict(meta or {})
            meta2["matrix_root"] = _matrix_root_payload(info.pool, seat)

            if not dry_run:
                tx.meta = meta2
                tx.save(update_fields=["meta"])

            updated += 1

        self.stdout.write(self.style.SUCCESS("Backfill complete"))
        self.stdout.write(f"processed={processed} updated={updated} dry_run={dry_run} force={force} pool_filter={pool_filter or 'ALL'}")
        self.stdout.write(
            f"skipped_has_meta={skipped_has_meta} skipped_no_source={skipped_no_source} skipped_no_trigger={skipped_no_trigger} skipped_no_match={skipped_no_match}"
        )

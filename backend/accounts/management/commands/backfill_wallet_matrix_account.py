from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

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

    if t in {"INCOME_CREDIT_75", "SELF_ACCOUNT_CREDIT"}:
        meta = getattr(tx, "meta", None) or {}
        orig = str((meta or {}).get("orig_type") or "").strip().upper()
        if orig == "AUTOPOOL_BONUS_FIVE":
            return _TxPoolInfo(pool="FIVE_150", tx_type=orig)
        if orig == "AUTOPOOL_BONUS_THREE":
            return _TxPoolInfo(pool="THREE_150", tx_type=orig)

    return None


def _tx_source_candidates(tx: WalletTransaction) -> list[Tuple[str, str]]:
    """Return possible (source_type, source_id) pairs for locating the trigger seat.

    Older data sometimes uses tx.source_type= PROMO_PURCHASE_APPROVAL but also stores
    meta.trigger = PRIME_750 / MONTHLY_759, which matches AutoPoolAccount.source_type.
    """
    meta = getattr(tx, "meta", None) or {}

    sid = str(getattr(tx, "source_id", "") or "").strip() or str((meta or {}).get("source_id") or "").strip()
    if not sid:
        return []

    candidates: list[Tuple[str, str]] = []
    for st in (
        str(getattr(tx, "source_type", "") or "").strip(),
        str((meta or {}).get("source_type") or "").strip(),
        str((meta or {}).get("trigger") or "").strip(),
    ):
        st2 = str(st or "").strip()
        if st2:
            candidates.append((st2, sid))

    # Dedupe while preserving order
    out: list[Tuple[str, str]] = []
    seen = set()
    for st, sid2 in candidates:
        key = (st.upper(), str(sid2))
        if key in seen:
            continue
        seen.add(key)
        out.append((st, sid2))
    return out


def _find_trigger_account(pool: str, source_type: str, source_id: str) -> Optional[AutoPoolAccount]:
    if not (pool and source_type and source_id):
        return None

    qs = AutoPoolAccount.objects.filter(
        pool_type=pool,
        source_type__iexact=str(source_type),
        source_id=str(source_id),
    ).only("id", "owner_id", "parent_account_id", "source_type", "source_id", "pool_type", "status")

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

    # Edge-case: some historical data credits the same user that owns the trigger seat.
    # In that case, attribute to the trigger seat itself.
    try:
        if int(getattr(trigger, "owner_id", 0) or 0) == int(user_id or 0):
            return trigger
    except Exception:
        pass

    return None


def _seat_from_meta_matrix_root(tx: WalletTransaction, pool: str) -> Optional[AutoPoolAccount]:
    meta = getattr(tx, "meta", None) or {}
    root = (meta or {}).get("matrix_root")

    account_id = None
    if isinstance(root, dict):
        account_id = root.get("account_id")
    else:
        account_id = root

    try:
        rid = int(str(account_id).strip())
    except Exception:
        return None
    if rid <= 0:
        return None

    try:
        seat = (
            AutoPoolAccount.objects
            .filter(id=rid, pool_type=pool)
            .only("id", "owner_id", "pool_type")
            .first()
        )
    except Exception:
        return None

    if not seat:
        return None

    if int(getattr(seat, "owner_id", 0) or 0) != int(getattr(tx, "user_id", 0) or 0):
        return None

    return seat


class Command(BaseCommand):
    help = "Backfill WalletTransaction.matrix_account for existing matrix credits (AUTOPOOL_BONUS_* and split credits)."

    def add_arguments(self, parser):
        parser.add_argument("--user-id", type=int, default=None, help="Only process this credited user id")
        parser.add_argument("--pool", type=str, default="", help="Filter by pool: FIVE_150 | THREE_150")
        parser.add_argument("--limit", type=int, default=0, help="Max transactions to process (0 = no limit)")
        parser.add_argument("--batch-size", type=int, default=500, help="Bulk update batch size")
        parser.add_argument("--dry-run", action="store_true", help="Do not write changes")
        parser.add_argument("--force", action="store_true", help="Overwrite existing matrix_account")

    def handle(self, *args, **opts):
        user_id = opts.get("user_id")
        pool_filter = str(opts.get("pool") or "").strip().upper()
        limit = int(opts.get("limit") or 0)
        batch_size = max(50, int(opts.get("batch_size") or 500))
        dry_run = bool(opts.get("dry_run"))
        force = bool(opts.get("force"))

        qs = WalletTransaction.objects.filter(amount__gt=0).order_by("created_at", "id")
        if user_id:
            qs = qs.filter(user_id=int(user_id))

        qs = qs.filter(
            type__in=(
                "AUTOPOOL_BONUS_FIVE",
                "AUTOPOOL_BONUS_THREE",
                "INCOME_CREDIT_75",
                "SELF_ACCOUNT_CREDIT",
            )
        )

        if not force:
            qs = qs.filter(matrix_account__isnull=True)

        if limit > 0:
            qs = qs[:limit]

        processed = 0
        updated = 0
        would_update = 0
        skipped_no_source = 0
        skipped_no_trigger = 0
        skipped_no_match = 0
        skipped_owner_mismatch = 0

        to_update: list[WalletTransaction] = []

        def flush():
            nonlocal updated
            if dry_run or not to_update:
                to_update.clear()
                return
            with transaction.atomic():
                WalletTransaction.objects.bulk_update(to_update, ["matrix_account"], batch_size=len(to_update))
            updated += len(to_update)
            to_update.clear()

        for tx in qs.iterator(chunk_size=500):
            processed += 1

            info = _pool_for_tx(tx)
            if not info:
                continue
            if pool_filter and info.pool != pool_filter:
                continue

            # If meta.matrix_root already exists, prefer it (most reliable attribution).
            seat_from_meta = _seat_from_meta_matrix_root(tx, info.pool)
            if seat_from_meta:
                would_update += 1
                if not dry_run:
                    tx.matrix_account = seat_from_meta
                    to_update.append(tx)
                    if len(to_update) >= batch_size:
                        flush()
                continue

            candidates = _tx_source_candidates(tx)
            if not candidates:
                skipped_no_source += 1
                continue

            trigger = None
            for st, sid in candidates:
                trigger = _find_trigger_account(info.pool, st, sid)
                if trigger:
                    break
            if not trigger:
                skipped_no_trigger += 1
                continue

            seat = _paid_seat_for_user(trigger, user_id=int(getattr(tx, "user_id", 0) or 0))
            if not seat:
                skipped_no_match += 1
                continue

            if int(getattr(seat, "owner_id", 0) or 0) != int(getattr(tx, "user_id", 0) or 0):
                skipped_owner_mismatch += 1
                continue

            would_update += 1

            if not dry_run:
                tx.matrix_account = seat
                to_update.append(tx)
                if len(to_update) >= batch_size:
                    flush()

        flush()

        self.stdout.write(self.style.SUCCESS("Backfill complete"))
        self.stdout.write(
            f"processed={processed} would_update={would_update} updated={updated} dry_run={dry_run} force={force} pool_filter={pool_filter or 'ALL'} batch_size={batch_size}"
        )
        self.stdout.write(
            f"skipped_no_source={skipped_no_source} skipped_no_trigger={skipped_no_trigger} skipped_no_match={skipped_no_match} skipped_owner_mismatch={skipped_owner_mismatch}"
        )

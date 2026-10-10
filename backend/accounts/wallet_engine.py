from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterable
from uuid import uuid4

from django.db import IntegrityError, models, transaction
from django.utils import timezone

from .finance_constants import ApprovalStatuses, FinanceStatuses, LedgerDirections, WalletTypes
from .models import CustomUser, FinancialTransaction, LedgerEntry, Wallet, WalletAccount, WalletTransaction


def _money(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "0")).quantize(Decimal("0.01"))
    except Exception:
        return Decimal("0.00")


@dataclass(frozen=True)
class LedgerPosting:
    user: CustomUser
    wallet_type: str
    direction: str
    amount: Decimal
    remarks: str = ""
    metadata: dict[str, Any] | None = None


class WalletEngine:
    """
    Additive finance engine.

    This service records structured FinancialTransaction + double-entry LedgerEntry rows
    without replacing the existing Wallet / WalletTransaction business flow yet.
    Existing UI and wallet behavior remain governed by the legacy models.
    """

    @classmethod
    def get_system_user(cls) -> CustomUser | None:
        try:
            return (
                CustomUser.objects.filter(category="company").order_by("id").first()
                or CustomUser.objects.filter(is_superuser=True).order_by("id").first()
                or CustomUser.objects.order_by("id").first()
            )
        except Exception:
            return None

    @classmethod
    def get_account(cls, user: CustomUser, wallet_type: str, *, lock: bool = True) -> WalletAccount:
        legacy_wallet = None
        try:
            legacy_wallet = Wallet.get_or_create_for_user(user)
        except Exception:
            legacy_wallet = None

        account, created = WalletAccount.objects.get_or_create(
            user=user,
            wallet_type=wallet_type,
            defaults={"legacy_wallet": legacy_wallet},
        )
        cfg_company_id = None
        try:
            from business.models import CommissionConfig
            _cu = CommissionConfig.get_solo().get_company_user()
            if _cu:
                cfg_company_id = getattr(_cu, "id", None)
        except Exception:
            pass

        is_sys = (
            (str(wallet_type or "").upper() == "SYSTEM")
            or getattr(user, "category", "") == "company"
            or (cfg_company_id is not None and getattr(user, "id", None) == cfg_company_id)
        )
        if lock and not is_sys and not created and transaction.get_connection().in_atomic_block:
            account = WalletAccount.objects.select_for_update().get(pk=account.pk)
        if legacy_wallet:
            dirty = False
            if created and not account.legacy_wallet_id:
                account.legacy_wallet = legacy_wallet
                dirty = True


            if dirty:
                account.save(update_fields=["legacy_wallet", "current_balance", "available_balance", "updated_at"])
        return account

    @classmethod
    def post_transaction(
        cls,
        *,
        category: str,
        postings: Iterable[LedgerPosting],
        user: CustomUser | None = None,
        source_module: str = "",
        source_id: str = "",
        destination_module: str = "",
        gross_amount: Any = None,
        charges_amount: Any = None,
        gst_amount: Any = None,
        tds_amount: Any = None,
        net_amount: Any = None,
        status: str = FinanceStatuses.COMPLETED,
        approval_status: str = ApprovalStatuses.NOT_REQUIRED,
        transaction_ref: str | None = None,
        idempotency_key: str | None = None,
        payment_gateway_reference: str = "",
        utr_number: str = "",
        reference_id: str = "",
        legacy_wallet_transaction: WalletTransaction | None = None,
        created_by: CustomUser | None = None,
        approved_by: CustomUser | None = None,
        remarks: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> FinancialTransaction:
        posting_list = list(postings)
        if not posting_list:
            raise ValueError("At least one ledger posting is required.")

        debit_total = sum((_money(p.amount) for p in posting_list if p.direction == LedgerDirections.DEBIT), Decimal("0.00"))
        credit_total = sum((_money(p.amount) for p in posting_list if p.direction == LedgerDirections.CREDIT), Decimal("0.00"))
        if debit_total != credit_total:
            raise ValueError("Ledger postings must balance.")

        tx_ref = transaction_ref or f"FT-{timezone.now():%Y%m%d}-{uuid4().hex[:12].upper()}"
        meta = dict(metadata or {})
        meta.setdefault("engine_version", "dual_write_v1")

        with transaction.atomic():
            if idempotency_key:
                existing = FinancialTransaction.objects.filter(idempotency_key=idempotency_key).first()
                if existing:
                    return existing

            try:
                ft = FinancialTransaction.objects.create(
                    transaction_ref=tx_ref,
                    flow_id=str(meta.get("flow_id") or ""),
                    idempotency_key=idempotency_key,
                    user=user,
                    category=category,
                    source_module=source_module,
                    source_id=str(source_id or ""),
                    destination_module=destination_module,
                    gross_amount=_money(gross_amount if gross_amount is not None else debit_total),
                    charges_amount=_money(charges_amount),
                    gst_amount=_money(gst_amount),
                    tds_amount=_money(tds_amount),
                    net_amount=_money(net_amount if net_amount is not None else credit_total),
                    status=status,
                    approval_status=approval_status,
                    payment_gateway_reference=payment_gateway_reference or "",
                    utr_number=utr_number or "",
                    reference_id=reference_id or "",
                    legacy_wallet_transaction=legacy_wallet_transaction,
                    created_by=created_by,
                    approved_by=approved_by,
                    approved_at=timezone.now() if approved_by else None,
                    remarks=remarks,
                    metadata=meta,
                )
            except IntegrityError:
                if idempotency_key:
                    existing = FinancialTransaction.objects.filter(idempotency_key=idempotency_key).first()
                    if existing:
                        return existing
                raise

            sys_user = cls.get_system_user()
            sys_user_id = getattr(sys_user, "id", 1)
            for index, posting in enumerate(posting_list, start=1):
                p_user_id = getattr(posting.user, "id", None)
                p_user_cat = getattr(posting.user, "category", "")
                is_system_acc = (
                    (str(posting.wallet_type or "").upper() == "SYSTEM")
                    or (sys_user_id is not None and p_user_id == sys_user_id)
                    or p_user_cat == "company"
                )
                account = cls.get_account(posting.user, posting.wallet_type, lock=not is_system_acc)
                amount = _money(posting.amount)
                before = _money(account.current_balance)
                if posting.direction == LedgerDirections.CREDIT:
                    after = before + amount
                elif posting.direction == LedgerDirections.DEBIT:
                    after = before - amount
                else:
                    raise ValueError(f"Invalid ledger direction: {posting.direction}")

                if is_system_acc:
                    # Skip synchronous updates on the system/company accounts to eliminate database row-lock contention.
                    pass
                else:
                    account.current_balance = after
                    account.available_balance = after
                    account.save(update_fields=["current_balance", "available_balance", "updated_at"])

                LedgerEntry.objects.create(
                    financial_transaction=ft,
                    wallet_account=account,
                    user=posting.user,
                    direction=posting.direction,
                    amount=amount,
                    balance_before=before,
                    balance_after=after,
                    status="POSTED",
                    entry_ref=f"{ft.transaction_ref}-{index}",
                    remarks=posting.remarks,
                    metadata=posting.metadata or {},
                )

            return ft

    @classmethod
    def reverse_transaction(
        cls,
        *,
        original: FinancialTransaction,
        actor: CustomUser | None = None,
        reason: str = "",
        idempotency_key: str | None = None,
    ) -> FinancialTransaction:
        entries = list(original.ledger_entries.select_related("user", "wallet_account").order_by("id"))
        if not entries:
            raise ValueError("Original financial transaction has no ledger entries to reverse.")

        reverse_postings = []
        for entry in entries:
            opposite = LedgerDirections.CREDIT if entry.direction == LedgerDirections.DEBIT else LedgerDirections.DEBIT
            reverse_postings.append(
                LedgerPosting(
                    user=entry.user,
                    wallet_type=entry.wallet_account.wallet_type,
                    direction=opposite,
                    amount=entry.amount,
                    remarks=f"Reversal of {original.transaction_ref}",
                    metadata={
                        "reversal_of_entry_id": entry.id,
                        "reversal_of_transaction_ref": original.transaction_ref,
                    },
                )
            )

        reversal = cls.post_transaction(
            category="REFUND",
            user=original.user,
            source_module="REVERSAL",
            source_id=str(original.id),
            destination_module=original.source_module or "",
            gross_amount=original.gross_amount,
            charges_amount=original.charges_amount,
            gst_amount=original.gst_amount,
            tds_amount=original.tds_amount,
            net_amount=original.net_amount,
            status=FinanceStatuses.REVERSED,
            approval_status=ApprovalStatuses.APPROVED,
            idempotency_key=idempotency_key or f"reverse:{original.transaction_ref}",
            reference_id=original.transaction_ref,
            created_by=actor,
            approved_by=actor,
            remarks=reason or f"Reversal of {original.transaction_ref}",
            metadata={
                "reversal_of_transaction_id": original.id,
                "reversal_of_transaction_ref": original.transaction_ref,
                "reason": reason,
            },
            postings=reverse_postings,
        )

        if original.status != FinanceStatuses.REVERSED:
            meta = dict(original.metadata or {})
            meta["reversed_by_transaction_ref"] = reversal.transaction_ref
            meta["reversal_reason"] = reason
            original.status = FinanceStatuses.REVERSED
            original.metadata = meta
            original.save(update_fields=["status", "metadata", "updated_at"])
        return reversal

    @classmethod
    def post_system_credit(
        cls,
        *,
        user: CustomUser,
        wallet_type: str,
        amount: Any,
        category: str,
        source_module: str,
        source_id: str = "",
        idempotency_key: str | None = None,
        legacy_wallet_transaction: WalletTransaction | None = None,
        actor: CustomUser | None = None,
        remarks: str = "",
        metadata: dict[str, Any] | None = None,
        utr_number: str = "",
    ) -> FinancialTransaction | None:
        system_user = cls.get_system_user()
        if not system_user:
            return None
        amt = _money(amount)
        return cls.post_transaction(
            category=category,
            user=user,
            source_module=source_module,
            source_id=source_id,
            destination_module=wallet_type,
            gross_amount=amt,
            net_amount=amt,
            idempotency_key=idempotency_key,
            legacy_wallet_transaction=legacy_wallet_transaction,
            created_by=actor,
            approved_by=actor,
            remarks=remarks,
            metadata=metadata,
            utr_number=utr_number,
            postings=[
                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.DEBIT, amt, metadata={"counterparty_user_id": user.id}),
                LedgerPosting(user, wallet_type, LedgerDirections.CREDIT, amt, metadata=metadata or {}),
            ],
        )

    @classmethod
    def post_system_debit(
        cls,
        *,
        user: CustomUser,
        wallet_type: str,
        amount: Any,
        category: str,
        source_module: str,
        source_id: str = "",
        idempotency_key: str | None = None,
        legacy_wallet_transaction: WalletTransaction | None = None,
        actor: CustomUser | None = None,
        remarks: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> FinancialTransaction | None:
        system_user = cls.get_system_user()
        if not system_user:
            return None
        amt = _money(amount)
        return cls.post_transaction(
            category=category,
            user=user,
            source_module=source_module,
            source_id=source_id,
            destination_module=WalletTypes.SYSTEM,
            gross_amount=amt,
            net_amount=amt,
            idempotency_key=idempotency_key,
            legacy_wallet_transaction=legacy_wallet_transaction,
            created_by=actor,
            approved_by=actor,
            remarks=remarks,
            metadata=metadata,
            postings=[
                LedgerPosting(user, wallet_type, LedgerDirections.DEBIT, amt, metadata=metadata or {}),
                LedgerPosting(system_user, WalletTypes.SYSTEM, LedgerDirections.CREDIT, amt, metadata={"counterparty_user_id": user.id}),
            ],
        )

    @classmethod
    def reconcile_wallet_accounts(cls, user: CustomUser) -> dict:
        """
        Generic, idempotent reconciliation of a user's WalletAccount balances.
        Audits live WalletAccount balances against the true double-entry LedgerEntry
        and WalletTransaction tables, repairing any historical drift or multi-crediting.
        """
        if not user or not getattr(user, "id", None):
            return {}

        results = {}
        # 1. MAIN WALLET
        try:
            main_acc = cls.get_account(user, WalletTypes.MAIN, lock=False)
            le_entries = LedgerEntry.objects.filter(wallet_account=main_acc, status="POSTED")
            if le_entries.exists():
                cr = le_entries.filter(direction=LedgerDirections.CREDIT).aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                db = le_entries.filter(direction=LedgerDirections.DEBIT).aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                true_main = max(Decimal("0.00"), cr - db)
            else:
                income_types = [
                    "INCOME_CREDIT_75", "DIRECT_REF_BONUS", "AUTOPOOL_BONUS_THREE",
                    "AUTOPOOL_BONUS_FIVE", "PINCODE_ROYALTY", "MONTHLY_759_DIRECT",
                    "MONTHLY_759_LEVEL", "PRIME_750_DIRECT", "COMMISSION_CREDIT",
                    "LEVEL_BONUS", "GLOBAL_ROYALTY", "FRANCHISE_INCOME"
                ]
                cr = WalletTransaction.objects.filter(
                    user=user, amount__gt=0, type__in=income_types
                ).exclude(meta__ledger="SELF_ACCOUNT").aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                db = WalletTransaction.objects.filter(
                    user=user, amount__lt=0
                ).exclude(type="SELF_ACCOUNT_DEBIT").aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                true_main = max(Decimal("0.00"), cr + db)

            if main_acc.current_balance != true_main:
                main_acc.current_balance = true_main
                main_acc.available_balance = true_main
                main_acc.save(update_fields=["current_balance", "available_balance", "updated_at"])
                results["MAIN"] = str(true_main)
        except Exception:
            pass

        # 2. SELF PACKAGE POCKET
        try:
            self_acc = cls.get_account(user, WalletTypes.SELF_PACKAGE_POCKET, lock=False)
            le_self = LedgerEntry.objects.filter(wallet_account=self_acc, status="POSTED")
            if le_self.exists():
                cr_s = le_self.filter(direction=LedgerDirections.CREDIT).aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                db_s = le_self.filter(direction=LedgerDirections.DEBIT).aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                true_self = max(Decimal("0.00"), cr_s - db_s)
            else:
                cr_s = WalletTransaction.objects.filter(
                    user=user, amount__gt=0, type="SELF_ACCOUNT_CREDIT"
                ).aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                db_s = WalletTransaction.objects.filter(
                    user=user, type="SELF_ACCOUNT_DEBIT"
                ).aggregate(models.Sum("amount"))["amount__sum"] or Decimal("0.00")
                true_self = max(Decimal("0.00"), cr_s + db_s)

            if self_acc.current_balance != true_self:
                self_acc.current_balance = true_self
                self_acc.available_balance = true_self
                self_acc.save(update_fields=["current_balance", "available_balance", "updated_at"])
                results["SELF_PACKAGE_POCKET"] = str(true_self)
        except Exception:
            pass

        # 3. WITHDRAWAL WALLET
        try:
            with_acc = cls.get_account(user, WalletTypes.WITHDRAWAL_WALLET, lock=False)
            main_acc = cls.get_account(user, WalletTypes.MAIN, lock=False)
            true_with = main_acc.current_balance if getattr(user, "account_active", False) else Decimal("0.00")
            if with_acc.current_balance != true_with:
                with_acc.current_balance = true_with
                with_acc.available_balance = true_with
                with_acc.save(update_fields=["current_balance", "available_balance", "updated_at"])
                results["WITHDRAWAL_WALLET"] = str(true_with)
        except Exception:
            pass

        return results


from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Optional

from .config import q2


@dataclass
class WalletPostResult:
    ok: bool
    balance_after: Optional[Decimal] = None
    error: Optional[str] = None


class WalletPoster:
    """
    Adapter around accounts.Wallet to keep mlm_ranks decoupled.
    Notes:
      - We allow the global 75/25 streaming rule to apply for rank upgrade payouts so that
        75% goes to main income and 25% to self account. Our own 25% level hold (7 days)
        remains handled via CommissionHold and is orthogonal to wallet streaming.
    """

    DIRECT_TX = "DIRECT_REF_BONUS"
    LEVEL_TX = "LEVEL_BONUS"
    COMPANY_GST_TX = "TAX_POOL_CREDIT"  # informational if needed

    @classmethod
    def _credit(cls, user, amount: Decimal, tx_type: str, *, source_type: str, source_id: str, meta: dict | None = None) -> WalletPostResult:
        try:
            from accounts.models import Wallet
            amt = q2(amount)
            if amt <= 0:
                return WalletPostResult(ok=True, balance_after=None)
            w = Wallet.get_or_create_for_user(user)
            meta2 = dict(meta or {})
            # Allow global 75/25 streaming; do not override with 'no_withhold' here.
            bal = w.credit(
                amt,
                tx_type=tx_type,
                meta=meta2,
                source_type=source_type or "",
                source_id=str(source_id or ""),
            )
            return WalletPostResult(ok=True, balance_after=bal)
        except Exception as e:
            return WalletPostResult(ok=False, error=str(e))

    @classmethod
    def credit_direct(cls, user, amount: Decimal, *, from_user_id: int, upgrade_id: int) -> WalletPostResult:
        meta = {"from_user_id": from_user_id, "upgrade_id": upgrade_id, "kind": "RANK_UPGRADE_DIRECT"}
        return cls._credit(user, amount, cls.DIRECT_TX, source_type="RANK_UPGRADE", source_id=str(upgrade_id), meta=meta)

    @classmethod
    def credit_level(cls, user, amount: Decimal, *, from_user_id: int, upgrade_id: int, level: int) -> WalletPostResult:
        meta = {"from_user_id": from_user_id, "upgrade_id": upgrade_id, "level": level, "kind": "RANK_UPGRADE_LEVEL"}
        return cls._credit(user, amount, cls.LEVEL_TX, source_type="RANK_UPGRADE", source_id=str(upgrade_id), meta=meta)

    @classmethod
    def credit_company_gst(cls, company_user, amount: Decimal, *, upgrade_id: int) -> WalletPostResult:
        # Optional GST posting if you want a ledger marker. Not required by spec.
        meta = {"upgrade_id": upgrade_id, "kind": "RANK_UPGRADE_GST"}
        return cls._credit(company_user, amount, cls.COMPANY_GST_TX, source_type="RANK_UPGRADE", source_id=str(upgrade_id), meta=meta)

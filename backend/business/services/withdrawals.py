from __future__ import annotations

from decimal import Decimal, ROUND_DOWN
from typing import Dict, Any

from accounts.models import Wallet, CustomUser
from business.models import CommissionConfig


def _q2(x) -> Decimal:
    try:
        return Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_DOWN)
    except Exception:
        return Decimal("0.00")


def compute_withdraw_distribution(user: CustomUser, gross_amount: Decimal | int | float | str) -> Dict[str, Any]:
    """
    Pure calculator for Direct Refer Withdraw Commission breakdown.
    Returns a dictionary describing how a withdrawal would be distributed:
      - Direct sponsor bonus (percent of gross)
      - TDS/Company pool (percent of gross)
      - Net to withdrawing user

    Does NOT mutate any state. Safe to call from API for preview.

    Output schema:
    {
      "input": { "user_id": int, "username": str, "gross_amount": "0.00" },
      "summary": {
        "sponsor_percent": "0.00",
        "tax_percent": "0.00",
        "gross": "0.00",
        "total_deductions": "0.00",
        "net_to_user": "0.00"
      },
      "lines": [
        {
          "key": "sponsor_bonus",
          "label": "Direct Sponsor Bonus",
          "amount": "0.00",
          "percent": "0.00",
          "recipient": { "id": int, "username": str },
          "tx_type": "DIRECT_REF_WITHDRAW_BONUS"
        },
        {
          "key": "tds",
          "label": "TDS/Company Pool",
          "amount": "0.00",
          "percent": "0.00",
          "recipient": { "id": int|null, "username": str|null },
          "tx_type": "TAX_POOL_CREDIT"
        }
      ]
    }
    """
    cfg = CommissionConfig.get_solo()
    gross = _q2(gross_amount)

    sponsor_percent = cfg.get_withdrawal_sponsor_percent()
    tax_percent = cfg.get_tax_percent()

    sponsor = getattr(user, "registered_by", None)
    sponsor_bonus = _q2(gross * sponsor_percent / Decimal("100")) if sponsor else Decimal("0.00")

    tds_amount = _q2(gross * tax_percent / Decimal("100"))
    company_user = cfg.get_company_user()

    net_to_user = _q2(gross - sponsor_bonus - tds_amount)
    if net_to_user < 0:
        net_to_user = Decimal("0.00")

    lines = []
    if sponsor and sponsor_bonus > 0:
        lines.append({
            "key": "sponsor_bonus",
            "label": "Direct Sponsor Bonus",
            "amount": f"{sponsor_bonus}",
            "percent": f"{sponsor_percent}",
            "recipient": {
                "id": getattr(sponsor, "id", None),
                "username": getattr(sponsor, "username", None),
            },
            "tx_type": "DIRECT_REF_WITHDRAW_BONUS",
        })

    if tds_amount > 0:
        lines.append({
            "key": "tds",
            "label": "TDS/Company Pool",
            "amount": f"{tds_amount}",
            "percent": f"{tax_percent}",
            "recipient": {
                "id": getattr(company_user, "id", None) if company_user else None,
                "username": getattr(company_user, "username", None) if company_user else None,
            },
            "tx_type": "TAX_POOL_CREDIT",
        })

    return {
        "input": {
            "user_id": getattr(user, "id", None),
            "username": getattr(user, "username", None),
            "gross_amount": f"{gross}",
        },
        "summary": {
            "sponsor_percent": f"{sponsor_percent}",
            "tax_percent": f"{tax_percent}",
            "gross": f"{gross}",
            "total_deductions": f"{_q2(sponsor_bonus + tds_amount)}",
            "net_to_user": f"{net_to_user}",
        },
        "lines": lines,
    }


def apply_withdraw_distribution(
    user: CustomUser,
    gross_amount: Decimal | int | float | str,
    source_type: str = "WITHDRAWAL",
    source_id: str = "",
) -> Dict[str, Any]:
    """
    Applies the computed distribution:
      - Credits Direct Sponsor with DIRECT_REF_WITHDRAW_BONUS
      - Credits Company user (if configured) with TAX_POOL_CREDIT

    Returns the same breakdown dictionary as compute_withdraw_distribution.
    """
    breakdown = compute_withdraw_distribution(user, gross_amount)

    for line in breakdown.get("lines", []):
        try:
            amt = _q2(line.get("amount"))
        except Exception:
            amt = Decimal("0.00")
        if amt <= 0:
            continue

        key = str(line.get("key") or "")
        tx_type = str(line.get("tx_type") or "COMMISSION_CREDIT")

        recipient = None
        if key == "sponsor_bonus":
            recipient = getattr(user, "registered_by", None)
        elif key == "tds":
            recipient = CommissionConfig.get_solo().get_company_user()

        if not recipient:
            continue

        try:
            w = Wallet.get_or_create_for_user(recipient)
            meta = {
                "source": source_type,
                "source_id": source_id,
                "from_user_id": getattr(user, "id", None),
                "from_user": getattr(user, "username", None),
                "breakdown_key": key,
            }
            w.credit(amt, tx_type=tx_type, meta=meta, source_type=source_type, source_id=str(source_id or ""))
        except Exception:
            # best-effort
            continue

    return breakdown

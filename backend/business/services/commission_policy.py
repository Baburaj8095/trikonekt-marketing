from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Optional, Tuple

from business.models import CommissionConfig


class ConfigurationError(RuntimeError):
    pass


def _D(x) -> Decimal:
    try:
        return Decimal(str(x))
    except (InvalidOperation, Exception):
        raise ConfigurationError(f"Invalid decimal value: {x!r}")


def _B(x) -> bool:
    if isinstance(x, bool):
        return x
    s = str(x).strip().lower()
    if s in ("1", "true", "yes", "y", "on"):
        return True
    if s in ("0", "false", "no", "n", "off"):
        return False
    raise ConfigurationError(f"Invalid boolean value: {x!r}")


def _I(x) -> int:
    try:
        return int(x)
    except Exception:
        raise ConfigurationError(f"Invalid integer value: {x!r}")


@dataclass(frozen=True)
class Prime150Config:
    direct_sponsor: Decimal
    direct_self: Decimal
    enable_3_matrix: bool
    enable_5_matrix: bool
    coupon_activation_count: int
    reward_points_amount: Decimal


@dataclass(frozen=True)
class Prime750Config:
    base_package: str
    multiplier: int


@dataclass(frozen=True)
class Monthly759BoxConfig:
    direct_sponsor: Decimal
    enable_3_matrix: bool  # only used for first_box; ignored for recurring
    enable_5_matrix: bool  # only used for first_box; ignored for recurring
    coupon_activation_amount: Decimal


class CommissionPolicy:
    """
    Centralized, validated commission policy loader.

    Expects CommissionConfig.master_commission_json to contain:
      {
        "commissions": {
          "prime_150": {
            "direct": {"sponsor": <num>, "self": <num>},
            "matrix": {"enable_3": <bool>, "enable_5": <bool>},
            "coupons": {"activation_count": <int>},
            "rewards": {"points_amount": <num>}
          },
          "prime_750": {
            "base_package": "prime_150",
            "multiplier": <int>
          },
          "monthly_759": {
            "first_box": {
              "direct": {"sponsor": <num>},
              "matrix": {"enable_3": <bool>, "enable_5": <bool>},
              "coupons": {"activation_amount": <num>}
            },
            "recurring_box": {
              "direct": {"sponsor": <num>},
              "coupons": {"activation_amount": <num>}
            }
          }
        }
      }

    No hardcoded rupee defaults. Missing/invalid values raise ConfigurationError.
    """

    def __init__(self, root: Dict[str, Any]) -> None:
        self._root = root or {}
        self._comm = dict(self._root.get("commissions") or {})
        if not self._comm:
            raise ConfigurationError("Commission policy missing at master_commission_json['commissions'].")

    @classmethod
    def load(cls) -> "CommissionPolicy":
        cfg = CommissionConfig.get_solo()
        data = dict(getattr(cfg, "master_commission_json", {}) or {})
        commissions = data.get("commissions")
        if not isinstance(commissions, dict) or not commissions:
            # Synthesize minimal commissions block from existing master keys (admin UI driven)
            synthesized = cls._synth_from_master(data)
            data = dict(data)
            data["commissions"] = synthesized
        return cls(data)

    def _get(self, *path: str) -> Any:
        cur: Any = self._comm
        for p in path:
            if not isinstance(cur, dict) or p not in cur:
                raise ConfigurationError(f"Missing config path: commissions.{'.'.join(path)}")
            cur = cur[p]
        return cur

    def _validate(self) -> None:
        """
        Reserved for future full-policy validation.
        Runtime callers (prime/monthly getters) perform section-level validation on demand.
        """
        return

    def prime150(self) -> Prime150Config:
        d = self._get("prime_150", "direct")
        m = self._get("prime_150", "matrix")
        c = self._get("prime_150", "coupons")
        r = self._get("prime_150", "rewards")
        return Prime150Config(
            direct_sponsor=_D(d.get("sponsor")),
            direct_self=_D(d.get("self")),
            enable_3_matrix=_B(m.get("enable_3")),
            enable_5_matrix=_B(m.get("enable_5")),
            coupon_activation_count=_I(c.get("activation_count")),
            reward_points_amount=_D(r.get("points_amount")),
        )

    def prime750(self) -> Prime750Config:
        b = self._get("prime_750", "base_package")
        mul = self._get("prime_750", "multiplier")
        bp = str(b).strip().lower()
        if bp != "prime_150":
            raise ConfigurationError(f"Unsupported base_package for prime_750: {b!r}. Only 'prime_150' is allowed.")
        m = _I(mul)
        if m <= 0:
            raise ConfigurationError("prime_750.multiplier must be a positive integer")
        return Prime750Config(base_package="prime_150", multiplier=m)

    def monthly759_first(self) -> Monthly759BoxConfig:
        fb = self._get("monthly_759", "first_box")
        d = fb.get("direct") or {}
        mx = fb.get("matrix") or {}
        cp = fb.get("coupons") or {}
        return Monthly759BoxConfig(
            direct_sponsor=_D(d.get("sponsor")),
            enable_3_matrix=_B(mx.get("enable_3")),
            enable_5_matrix=_B(mx.get("enable_5")),
            coupon_activation_amount=_D(cp.get("activation_amount")),
        )

    def monthly759_recurring(self) -> Monthly759BoxConfig:
        rb = self._get("monthly_759", "recurring_box")
        d = rb.get("direct") or {}
        cp = rb.get("coupons") or {}
        # for recurring, matrix flags are irrelevant; keep False
        return Monthly759BoxConfig(
            direct_sponsor=_D(d.get("sponsor")),
            enable_3_matrix=False,
            enable_5_matrix=False,
            coupon_activation_amount=_D(cp.get("activation_amount")),
        )

    def raw_policy(self) -> Dict[str, Any]:
        return {"commissions": self._comm}

    def policy_hash(self) -> str:
        # Stable hash of just the commissions block
        payload = json.dumps(self._comm, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    # --------- Internal helpers ---------
    @staticmethod
    def _enabled_from_cm(master: Dict[str, Any], key: str, product_key: str) -> bool:
        """
        Determine if a consumer matrix (3 or 5) is effectively enabled for a product key
        by inspecting presence of non-empty arrays or positive 'levels' in master json.
        """
        cm_all = dict(master.get(key, {}) or {})
        candidates = []
        for k in (product_key, "global", "default"):
            if k in cm_all:
                candidates.append(cm_all.get(k))
        # Alias support for product key "150"
        if product_key == "150":
            for alias in ("coupon150", "coupon_150", "prime150", "prime_150"):
                if alias in cm_all:
                    candidates.append(cm_all.get(alias))
        for v in candidates:
            if isinstance(v, list) and len(v) > 0:
                return True
            if isinstance(v, dict):
                # any non-empty list or positive levels key enables it
                for arr in v.values():
                    if isinstance(arr, list) and len(arr) > 0:
                        return True
                for name in ("levels", "five_matrix_levels", "three_matrix_levels"):
                    if name in v:
                        try:
                            if int(v[name]) > 0:
                                return True
                        except Exception:
                            pass
        return False

    @classmethod
    def _synth_from_master(cls, root: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build a minimal commissions block from existing admin-driven master keys so that
        the new payout engine can run without introducing implicit rupee defaults.
        Synthesize prime_150 and prime_750 from master config when explicit policy is absent,
        and also map monthly_759 to the new policy shape.
        """
        master = root or {}
        commissions: Dict[str, Any] = {}

        # -------- prime_150 (direct + enable flags; coupons/rewards safe-minimal) --------
        direct_all = dict(master.get("direct_bonus", {}) or {})
        row150 = dict(direct_all.get("150", {}) or {})
        if not row150:
            for alias in ("coupon150", "coupon_150", "prime150", "prime_150"):
                if alias in direct_all:
                    row150 = dict(direct_all.get(alias) or {})
                    break

        enable3_150 = cls._enabled_from_cm(master, "consumer_matrix_3", "150")
        enable5_150 = cls._enabled_from_cm(master, "consumer_matrix_5", "150")

        # Preserve existing coupons/rewards if present under commissions.prime_150
        existing_comm = dict(master.get("commissions", {}) or {})
        p150_existing = dict(existing_comm.get("prime_150", {}) or {})
        coupons_existing = dict(p150_existing.get("coupons", {}) or {})
        rewards_existing = dict(p150_existing.get("rewards", {}) or {})
        activation_count = coupons_existing.get("activation_count", 0)
        reward_points_amount = rewards_existing.get("points_amount", 0)

        commissions["prime_150"] = {
            "direct": {
                "sponsor": row150.get("sponsor", 0),
                "self": row150.get("self", 0),
            },
            "matrix": {
                "enable_3": enable3_150,
                "enable_5": enable5_150,
            },
            "coupons": {"activation_count": activation_count if isinstance(activation_count, (int, float, str)) else 0},
            "rewards": {"points_amount": reward_points_amount if isinstance(reward_points_amount, (int, float, str)) else 0},
        }

        # -------- prime_750 (policy ties to prime_150 via multiplier) --------
        commissions["prime_750"] = {
            "base_package": "prime_150",
            "multiplier": 1,  # safe minimal default; admin can override later via explicit policy
        }

        # -------- monthly_759 (first vs recurring, matrix flags, activation amount) --------
        m759 = dict(master.get("monthly_759", {}) or {})
        row759 = dict(direct_all.get("759", {}) or {})

        # Resolve sponsor amounts strictly from monthly_759 config to preserve first vs recurring
        first_sponsor = m759.get("direct_first_month")
        recurring_sponsor = m759.get("direct_monthly")

        # Self bonus (activation) configured in direct_bonus["759"].self; apply to first and recurring boxes
        self_bonus = row759.get("self", None)

        # Base amount for coupon activation amount and reward points (no rupee defaults here)
        base_amount = m759.get("base_amount")

        enable3 = cls._enabled_from_cm(master, "consumer_matrix_3", "759")
        enable5 = cls._enabled_from_cm(master, "consumer_matrix_5", "759")

        # Build direct nodes, injecting self when provided
        direct_first = {"sponsor": first_sponsor}
        direct_recurring = {"sponsor": recurring_sponsor}
        if self_bonus is not None:
            direct_first["self"] = self_bonus
            direct_recurring["self"] = self_bonus

        commissions["monthly_759"] = {
            "first_box": {
                "direct": direct_first,
                "matrix": {"enable_3": enable3, "enable_5": enable5},
                "coupons": {"activation_amount": base_amount},
            },
            "recurring_box": {
                "direct": direct_recurring,
                "coupons": {"activation_amount": base_amount},
            },
        }

        return commissions

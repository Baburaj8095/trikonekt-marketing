from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction

from business.models import CommissionConfig


def _to_float(x, default=0.0) -> float:
    try:
        return float(Decimal(str(x)))
    except Exception:
        try:
            return float(x)
        except Exception:
            return float(default)


def _norm_list(lst, to_float: bool = True) -> List[float]:
    out: List[float] = []
    try:
        for v in list(lst or []):
            out.append(_to_float(v) if to_float else v)
    except Exception:
        pass
    return out


def _default_master(cfg: CommissionConfig) -> Dict[str, Any]:
    """
    Build a sane default master_commission_json using current model fields as fallbacks.
    This covers:
      - tax.percent
      - withdrawal.sponsor_percent
      - upline l1..l5 percents
      - geo percents for agency roles
      - matrix_three/matrix_five levels and fixed/percents arrays
      - referral_join: direct fixed amount and l1..l5 fixed amounts (if present on legacy json)
      - auto_block: operational defaults for auto block-based workflows
    """
    # Legacy fixed rupees for referral join (if present)
    rjf = dict(getattr(cfg, "referral_join_fixed_json", {}) or {})
    referral_direct = _to_float(rjf.get("direct", 15.0), 15.0)
    referral_levels = [
        _to_float(rjf.get("l1", 2.0), 2.0),
        _to_float(rjf.get("l2", 1.0), 1.0),
        _to_float(rjf.get("l3", 1.0), 1.0),
        _to_float(rjf.get("l4", 0.5), 0.5),
        _to_float(rjf.get("l5", 0.5), 0.5),
    ]

    # Matrix fixed and percent arrays
    three_amounts = _norm_list(getattr(cfg, "three_matrix_amounts_json", []) or [])
    three_percents = _norm_list(getattr(cfg, "three_matrix_percents_json", []) or [])
    five_amounts = _norm_list(getattr(cfg, "five_matrix_amounts_json", []) or [])
    # five_matrix_percents_json not maintained in model; keep empty unless provided via API later
    five_percents: List[float] = []

    return {
        "tax": {"percent": _to_float(getattr(cfg, "tax_percent", 10.0), 10.0)},
        "withdrawal": {"sponsor_percent": 3.0},  # historical default
        "upline": {
            "l1": _to_float(getattr(cfg, "l1_percent", 2.0), 2.0),
            "l2": _to_float(getattr(cfg, "l2_percent", 1.0), 1.0),
            "l3": _to_float(getattr(cfg, "l3_percent", 1.0), 1.0),
            "l4": _to_float(getattr(cfg, "l4_percent", 0.5), 0.5),
            "l5": _to_float(getattr(cfg, "l5_percent", 0.5), 0.5),
        },
        "geo": {
            "sub_franchise": _to_float(getattr(cfg, "sub_franchise_percent", 15.0), 15.0),
            "pincode": _to_float(getattr(cfg, "pincode_percent", 4.0), 4.0),
            "pincode_coord": _to_float(getattr(cfg, "pincode_coord_percent", 2.0), 2.0),
            "district": _to_float(getattr(cfg, "district_percent", 1.0), 1.0),
            "district_coord": _to_float(getattr(cfg, "district_coord_percent", 1.0), 1.0),
            "state": _to_float(getattr(cfg, "state_percent", 1.0), 1.0),
            "state_coord": _to_float(getattr(cfg, "state_coord_percent", 1.0), 1.0),
            "employee": _to_float(getattr(cfg, "employee_percent", 2.0), 2.0),
            "royalty": _to_float(getattr(cfg, "royalty_percent", 10.0), 10.0),
        },
        "matrix_three": {
            "levels": int(getattr(cfg, "three_matrix_levels", 15) or 15),
            "fixed_amounts": three_amounts,
            "percents": three_percents,
        },
        "matrix_five": {
            "levels": int(getattr(cfg, "five_matrix_levels", 6) or 6),
            "fixed_amounts": five_amounts,
            "percents": five_percents,
        },
        "referral_join": {
            "direct": referral_direct,
            "levels": referral_levels,
        },
        "auto_block": {
            "block_size": 1000.00,
            "coupon_cost": _to_float(getattr(cfg, "base_coupon_value", 150.00), 150.00),
            "tds_fixed": 50.00,
            "sponsor_bonus": 50.00,
            "enable_coupon": True,
        },
        # MONTHLY 759 defaults (admin can override in master_commission_json)
        "monthly_759": {
            "direct_first_month": 250.0,
            "direct_monthly": 50.0,
            "levels_fixed": [50.0, 10.0, 5.0, 5.0, 10.0],
            "agency_enabled": True
        },
    }


class Command(BaseCommand):
    help = "Seed or repair the Master Commission configuration (CommissionConfig.master_commission_json)."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing master_commission_json with defaults.",
        )
        parser.add_argument(
            "--company-user-id",
            type=int,
            default=0,
            help="Set tax_company_user to this user id (0 to skip).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force: bool = bool(options.get("force", False))
        company_user_id: int = int(options.get("company_user_id") or 0)

        cfg = CommissionConfig.get_solo()
        master = dict(getattr(cfg, "master_commission_json", {}) or {})

        if master and not force:
            self.stdout.write(self.style.WARNING("master_commission_json already present. Use --force to overwrite."))
        else:
            new_master = _default_master(cfg)
            cfg.master_commission_json = new_master
            self.stdout.write(self.style.SUCCESS("Prepared default master_commission_json."))

        # Optionally set tax_company_user
        if company_user_id and company_user_id > 0:
            from accounts.models import CustomUser
            cu = CustomUser.objects.filter(id=company_user_id).first()
            if not cu:
                self.stdout.write(self.style.ERROR(f"User id {company_user_id} not found; skipping tax_company_user."))
            else:
                cfg.tax_company_user = cu
                self.stdout.write(self.style.SUCCESS(f"Set tax_company_user -> {cu.username} (id={cu.id})."))
        else:
            # If not set, try a best-effort default (company category or superuser)
            try:
                if not getattr(cfg, "tax_company_user_id", None):
                    from accounts.models import CustomUser
                    cu_auto = CustomUser.objects.filter(category="company").first() or CustomUser.objects.filter(is_superuser=True).first()
                    if cu_auto:
                        cfg.tax_company_user = cu_auto
                        self.stdout.write(self.style.SUCCESS(f"Auto-set tax_company_user -> {cu_auto.username} (id={cu_auto.id})."))
            except Exception:
                pass

        cfg.save(update_fields=["master_commission_json", "tax_company_user", "updated_at"])
        self.stdout.write(self.style.SUCCESS("Saved CommissionConfig with master_commission_json."))

        # Show a compact summary for admin shell visibility
        m = dict(cfg.master_commission_json or {})
        tax = m.get("tax", {})
        wd = m.get("withdrawal", {})
        upline = m.get("upline", {})
        self.stdout.write("Summary:")
        self.stdout.write(f"  tax.percent = {tax.get('percent')}")
        self.stdout.write(f"  withdrawal.sponsor_percent = {wd.get('sponsor_percent')}")
        self.stdout.write(f"  upline = {upline}")
        self.stdout.write(f"  company_user = {getattr(cfg.tax_company_user, 'username', None)} (id={getattr(cfg.tax_company_user, 'id', None)})")

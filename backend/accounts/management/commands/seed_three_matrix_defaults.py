from __future__ import annotations

import json
from typing import List

from django.core.management.base import BaseCommand
from business.models import CommissionConfig


def _parse_list(arg: str | None) -> List[float]:
    if not arg:
        return []
    s = arg.strip()
    # Try JSON first
    if s.startswith("["):
        try:
            vals = json.loads(s)
            if isinstance(vals, list):
                return [float(x) for x in vals]
        except Exception:
            pass
    # Fallback: comma-separated
    try:
        return [float(x.strip()) for x in s.split(",") if x.strip() != ""]
    except Exception:
        return []


class Command(BaseCommand):
    help = (
        "Seed sensible defaults for 3-matrix configuration.\n"
        "- Sets three_matrix_levels (default 15)\n"
        "- Optionally sets three_matrix_percents_json or three_matrix_amounts_json (fixed rupees per level)\n"
        "- Optionally enables autopool_trigger_on_direct_referral so new joins trigger 3-matrix distribution\n"
        "Usage examples:\n"
        "  python manage.py seed_three_matrix_defaults\n"
        "  python manage.py seed_three_matrix_defaults --levels=15 --percents='[20,15,10,8,6,5,5,4,4,3,3,3,2,1,1]'\n"
        "  python manage.py seed_three_matrix_defaults --fixed='[5,4,3,3,3,3,2,2,2,2,2,1,1,1,1]' --enable-trigger=1\n"
    )

    def add_arguments(self, parser):
        parser.add_argument("--levels", type=int, default=15, help="Number of 3-matrix levels (default 15, safety-capped elsewhere)")
        parser.add_argument("--percents", type=str, default="", help="JSON or CSV list of percents per level for THREE pools")
        parser.add_argument("--fixed", type=str, default="", help="JSON or CSV list of fixed rupees per level (overrides percents when non-empty)")
        parser.add_argument("--enable-trigger", type=int, default=1, help="Set autopool_trigger_on_direct_referral to 1/0 (default 1)")
        parser.add_argument("--force", action="store_true", help="Force overwrite existing three_matrix configs")

    def handle(self, *args, **opts):
        levels: int = int(opts["levels"] or 15)
        force: bool = bool(opts.get("force", False))
        percents_in = _parse_list(opts.get("percents", "")) or []
        fixed_in = _parse_list(opts.get("fixed", "")) or []
        enable_trigger = int(opts.get("enable_trigger", 1) or 1)

        cfg = CommissionConfig.get_solo()

        # Levels
        changed = False
        if force or (int(getattr(cfg, "three_matrix_levels", 0) or 0) != levels):
            cfg.three_matrix_levels = levels
            changed = True

        # Defaults only if not present OR --force
        # If fixed provided, set fixed (overrides percent-based logic where used)
        if fixed_in:
            cfg.three_matrix_amounts_json = list(fixed_in[:levels])
            changed = True
            self.stdout.write(self.style.WARNING(f"three_matrix_amounts_json updated to {cfg.three_matrix_amounts_json}"))
        elif percents_in:
            cfg.three_matrix_percents_json = list(percents_in[:levels])
            changed = True
            self.stdout.write(self.style.WARNING(f"three_matrix_percents_json updated to {cfg.three_matrix_percents_json}"))
        elif force or not (getattr(cfg, "three_matrix_percents_json", []) or getattr(cfg, "three_matrix_amounts_json", [])):
            # Apply a conservative default percent split if nothing configured:
            # Sums to 90% across 15 levels to avoid overpaying by default.
            default_percents = [20, 15, 10, 8, 6, 5, 5, 4, 4, 3, 3, 3, 2, 1, 1][:levels]
            cfg.three_matrix_percents_json = default_percents
            changed = True
            self.stdout.write(self.style.WARNING(f"Applied default three_matrix_percents_json={default_percents}"))

        # Toggle direct-referral trigger (fires THREE_50 distribution on joins in referral.on_user_join)
        target = bool(enable_trigger)
        if bool(getattr(cfg, "autopool_trigger_on_direct_referral", True)) != target:
            cfg.autopool_trigger_on_direct_referral = target
            changed = True
            self.stdout.write(self.style.WARNING(f"autopool_trigger_on_direct_referral set to {target}"))

        if changed:
            cfg.save()
            self.stdout.write(self.style.SUCCESS("3-matrix defaults updated."))
        else:
            self.stdout.write(self.style.NOTICE("No changes needed; config already set."))

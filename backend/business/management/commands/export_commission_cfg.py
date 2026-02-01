import json
from pathlib import Path
from decimal import Decimal

from django.core.management.base import BaseCommand

from business.models import CommissionConfig


def conv(o):
    if isinstance(o, Decimal):
        return float(o)
    if isinstance(o, dict):
        return {k: conv(v) for k, v in o.items()}
    if isinstance(o, list):
        return [conv(x) for x in o]
    return o


class Command(BaseCommand):
    help = "Export CommissionConfig to JSON (default: ../diag_db_monthly_759.json from backend/)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--out",
            type=str,
            default=str(Path("..") / "diag_db_monthly_759.json"),
            help="Output JSON file path",
        )

    def handle(self, *args, **options):
        cfg = CommissionConfig.get_solo()
        data = {
            "id": cfg.id,
            "updated_at": str(cfg.updated_at),
            "master": conv(dict(getattr(cfg, "master_commission_json", {}) or {})),
        }

        out_path = Path(options["out"])
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

        self.stdout.write(self.style.SUCCESS(f"Wrote: {out_path.resolve()}"))

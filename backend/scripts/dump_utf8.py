import os
import sys
from pathlib import Path

# Ensure backend package is importable
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

import django  # noqa: E402
django.setup()

from django.core.management import call_command  # noqa: E402


def dump_utf8(app_label: str, out_path: str):
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    # Open file explicitly with UTF-8 so loaddata can decode reliably
    with out.open("w", encoding="utf-8", newline="\n") as f:
        call_command(
            "dumpdata",
            app_label,
            stdout=f,
            use_natural_foreign_keys=True,
            use_natural_primary_keys=True,
            exclude=["contenttypes", "auth.permission", "admin.logentry", "sessions.session"],
        )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: dump_utf8.py <app_label> <output.json>")
        sys.exit(1)
    dump_utf8(sys.argv[1], sys.argv[2])

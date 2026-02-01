from __future__ import annotations

import os
import traceback
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).resolve().parents[1]  # .../v1/backend
PROJECT_ROOT = BACKEND_DIR.parent                  # .../v1
STATUS_PATH = PROJECT_ROOT / "diag_db_connect.txt"

def main() -> None:
    try:
        # Ensure backend is CWD and settings are configured
        os.chdir(BACKEND_DIR)
        os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")

        import django  # noqa: E402
        django.setup()

        status = ["BOOT_OK"]

        # Try a simple DB query
        from django.db import connection  # noqa: E402
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                status.append("DB_OK")
        except Exception as e:
            status.append(f"DB_ERR: {repr(e)}")
            status.append(traceback.format_exc())

    except Exception as e:
        status = [f"BOOT_ERR: {repr(e)}", traceback.format_exc()]

    # Write status to project root
    STATUS_PATH.write_text("\n".join(status), encoding="utf-8")


if __name__ == "__main__":
    main()

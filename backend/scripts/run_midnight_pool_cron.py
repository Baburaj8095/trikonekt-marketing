#!/usr/bin/env python3
import os
import sys
import time
from datetime import datetime

# 1. Automatically load staging environment file if DATABASE_URL is not set
env_path = "/etc/trikonekt/staging-backend.env"
if os.path.isfile(env_path):
    with open(env_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip().strip("'").strip('"')

# 2. Setup Django
sys.path.insert(0, '/srv/trikonekt/staging/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from business.services.daily_pool_distributor import execute_daily_pool_distribution

try:
    from zoneinfo import ZoneInfo
    ist_tz = ZoneInfo("Asia/Kolkata")
except Exception:
    import pytz
    ist_tz = pytz.timezone("Asia/Kolkata")

now_ist = datetime.now(ist_tz)
date_str = now_ist.strftime("%Y-%m-%d")
print(f"[{datetime.now()}] Starting automatic midnight pool distribution for {date_str} (IST)...")

# 3. Execution with 3 automatic retries
max_retries = 3
retry_delay = 5

for attempt in range(1, max_retries + 1):
    try:
        print(f"[{datetime.now()}] Attempt {attempt}/{max_retries}...")
        res = execute_daily_pool_distribution(target_date=date_str, dry_run=False, force=False)
        print(f"Result (Attempt {attempt}):", res)
        if res.get("success") or res.get("is_already_distributed"):
            print(f"[{datetime.now()}] Distribution finished successfully on attempt {attempt}.")
            sys.exit(0)
        else:
            print(f"[{datetime.now()}] Warning: {res.get('message')}")
    except Exception as e:
        print(f"[{datetime.now()}] Error on attempt {attempt}: {e}")
        if attempt < max_retries:
            time.sleep(retry_delay * attempt)
        else:
            print(f"[{datetime.now()}] CRITICAL: All {max_retries} attempts failed.")
            sys.exit(1)

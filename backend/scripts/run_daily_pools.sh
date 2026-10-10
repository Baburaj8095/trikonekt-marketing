#!/bin/bash
# Production Daily Midnight Pools Runner with Environment Sourcing & 3 Retries

set -a
if [ -f /etc/trikonekt/staging-backend.env ]; then
    source /etc/trikonekt/staging-backend.env
fi
set +a

LOG_FILE="/var/log/trikonekt/run_daily_pools.log"
mkdir -p /var/log/trikonekt

MAX_RETRIES=3
RETRY_DELAY=5

for attempt in $(seq 1 $MAX_RETRIES); do
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Attempt $attempt/$MAX_RETRIES: Running distribute_daily_pools..." >> "$LOG_FILE"
    
    if /srv/trikonekt/staging/backend/.venv/bin/python /srv/trikonekt/staging/backend/manage.py distribute_daily_pools >> "$LOG_FILE" 2>&1; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Successfully finished distribute_daily_pools on attempt $attempt." >> "$LOG_FILE"
        exit 0
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed attempt $attempt. Retrying in ${RETRY_DELAY}s..." >> "$LOG_FILE"
        sleep $RETRY_DELAY
        RETRY_DELAY=$((RETRY_DELAY * 2))
    fi
done

echo "[$(date '+%Y-%m-%d %H:%M:%S')] CRITICAL: All $MAX_RETRIES attempts failed." >> "$LOG_FILE"
exit 1

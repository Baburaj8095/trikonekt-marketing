#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/trikonekt/app}"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="${ENV_FILE:-/etc/trikonekt/backend.env}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-https://api.growth.vin/healthz}"

echo "Deploying Trikonekt backend from branch: $BRANCH"

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Missing Git repository at $APP_DIR" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing env file at $ENV_FILE" >&2
  exit 1
fi
echo "Fetching latest changes from branch: $BRANCH"
if ! sudo -u trikonekt git -C "$APP_DIR" fetch --prune origin "$BRANCH"; then
  echo "Fetch failed. Attempting to prune remote tracking refs and retry..."
  sudo -u trikonekt git -C "$APP_DIR" remote prune origin
  sudo -u trikonekt git -C "$APP_DIR" fetch --prune origin "$BRANCH"
fi
sudo -u trikonekt git -C "$APP_DIR" checkout "$BRANCH"
sudo -u trikonekt git -C "$APP_DIR" reset --hard "origin/$BRANCH"

sudo -u trikonekt bash -lc "cd '$BACKEND_DIR' && .venv/bin/pip install -r requirements.txt"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py migrate --noinput"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py collectstatic --noinput"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py check"

sudo systemctl daemon-reload
sudo systemctl restart trikonekt-web trikonekt-worker
sudo systemctl --no-pager --full status trikonekt-web
sudo systemctl --no-pager --full status trikonekt-worker

echo "Waiting for health check: $HEALTH_URL"
for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error --location --head "$HEALTH_URL"; then
    echo "Health check passed on attempt $attempt."
    echo "Backend deploy completed successfully."
    exit 0
  fi
  echo "Health check attempt $attempt failed; retrying in 5 seconds..."
  sleep 5
done

echo "Health check failed after retries." >&2
sudo systemctl --no-pager --full status trikonekt-web >&2 || true
sudo journalctl -u trikonekt-web -n 80 --no-pager >&2 || true
exit 1

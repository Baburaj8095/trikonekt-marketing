#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/srv/trikonekt/app-staging}"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
ENV_FILE="${ENV_FILE:-/etc/trikonekt/staging-backend.env}"
BRANCH="${DEPLOY_BRANCH:-main}"
HEALTH_URL="${HEALTH_URL:-https://staging-api.growth.vin/healthz}"

echo "========================================="
echo " Deploying Trikonekt STAGING Environment "
echo " Target Domain: https://staging-growth.vin"
echo " Target API: https://staging-api.growth.vin"
echo " Branch: $BRANCH"
echo "========================================="

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Missing Staging Git repository at $APP_DIR" >&2
  echo "Clone it with: sudo git clone <repo_url> $APP_DIR" >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing Staging env file at $ENV_FILE" >&2
  echo "Copy staging-backend.env.example to $ENV_FILE and set your credentials." >&2
  exit 1
fi

echo "Fetching latest changes..."
sudo -u trikonekt git -C "$APP_DIR" fetch --prune origin "$BRANCH"
sudo -u trikonekt git -C "$APP_DIR" checkout "$BRANCH"
sudo -u trikonekt git -C "$APP_DIR" reset --hard "origin/$BRANCH"

# Install Backend Dependencies
echo "Checking backend dependencies..."
sudo -u trikonekt bash -lc "cd '$BACKEND_DIR' && .venv/bin/pip install --no-cache-dir -r requirements.txt"

# Run Migrations on STAGING Database
echo "Running database migrations on trikonekt_staging..."
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py migrate --noinput"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py collectstatic --noinput"

# Build Staging Frontend
echo "Building Staging Frontend React app..."
if [ -d "$FRONTEND_DIR" ]; then
  sudo -u trikonekt bash -lc "cd '$FRONTEND_DIR' && npm ci && cp .env.staging .env.production && npm run build"
fi

# Restart Staging Systemd Services
echo "Restarting Staging services..."
sudo systemctl daemon-reload
sudo systemctl restart trikonekt-staging-web trikonekt-staging-worker
sudo systemctl reload nginx

echo "Waiting for Staging Health check: $HEALTH_URL"
for attempt in $(seq 1 30); do
  if curl --fail --silent --insecure --show-error --location "$HEALTH_URL"; then
    echo "Staging Health check passed on attempt $attempt."
    echo "Staging deploy completed successfully!"
    exit 0
  fi
  echo "Staging Health check attempt $attempt failed; retrying in 5 seconds..."
  sleep 5
done

echo "Health check failed after retries." >&2
sudo systemctl --no-pager --full status trikonekt-staging-web >&2 || true
sudo journalctl -u trikonekt-staging-web -n 80 --no-pager >&2 || true
exit 1

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

sudo -u trikonekt git -C "$APP_DIR" fetch origin "$BRANCH"
sudo -u trikonekt git -C "$APP_DIR" checkout "$BRANCH"
sudo -u trikonekt git -C "$APP_DIR" pull --ff-only origin "$BRANCH"

sudo -u trikonekt bash -lc "cd '$BACKEND_DIR' && .venv/bin/pip install -r requirements.txt"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py migrate --noinput"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py collectstatic --noinput"
sudo -u trikonekt bash -lc "set -a; source '$ENV_FILE'; set +a; cd '$BACKEND_DIR' && .venv/bin/python manage.py check"

sudo systemctl daemon-reload
sudo systemctl restart trikonekt-web trikonekt-worker
sudo systemctl --no-pager --full status trikonekt-web
sudo systemctl --no-pager --full status trikonekt-worker

curl --fail --silent --show-error --location --head "$HEALTH_URL"

echo "Backend deploy completed successfully."

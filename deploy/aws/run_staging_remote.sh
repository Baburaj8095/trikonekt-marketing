#!/usr/bin/env bash
set -e

echo "=== STEP 1: Create RDS Staging Database ==="
PGPASSWORD="Baburajnk19" psql -h trikonekt-prod-postgres.crm64c24gey6.ap-south-1.rds.amazonaws.com -U trikonekt_admin -d trikonekt -c "CREATE DATABASE trikonekt_staging;" || true

echo "=== STEP 2: Setup Staging Env File ==="
cp /tmp/staging-backend.env /etc/trikonekt/staging-backend.env
chown root:trikonekt /etc/trikonekt/staging-backend.env
chmod 640 /etc/trikonekt/staging-backend.env

echo "=== STEP 3: Setup Systemd Services ==="
cp /tmp/trikonekt-staging-web.service /etc/systemd/system/
cp /tmp/trikonekt-staging-worker.service /etc/systemd/system/
systemctl daemon-reload

echo "=== STEP 4: Run Staging Migrations ==="
sudo -u trikonekt bash -lc "set -a; source /etc/trikonekt/staging-backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py migrate --noinput"

echo "=== STEP 5: SSL Certbot for staging-api.growth.vin ==="
certbot --nginx -d staging-api.growth.vin --non-interactive --agree-tos -m contact@trikonekt.com --redirect || true

echo "=== STEP 6: Start Staging Services & Reload Nginx ==="
systemctl enable trikonekt-staging-web trikonekt-staging-worker
systemctl restart trikonekt-staging-web trikonekt-staging-worker
systemctl reload nginx

echo "=== STAGING BACKEND SERVICE STATUS ==="
systemctl status trikonekt-staging-web --no-pager

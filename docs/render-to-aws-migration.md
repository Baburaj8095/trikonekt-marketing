# Render to AWS Migration Record

This document records the end-to-end migration performed to bring the Trikonekt backend service back up on AWS while keeping the frontend on Vercel.

## Final Architecture

- Frontend: Vercel
- API domain: `https://api.growth.vin`
- Backend host: AWS EC2 Ubuntu in `ap-south-1`
- Backend process: Django + Gunicorn managed by systemd
- Background worker: Django management command managed by systemd
- Database: AWS RDS PostgreSQL
- Reverse proxy: Nginx on EC2
- SSL: Let's Encrypt certificate for `api.growth.vin`
- Media: existing app media storage retained through configured production env, for example Cloudinary when `CLOUDINARY_URL` is set

Request flow:

```text
Vercel frontend
  -> https://api.growth.vin
  -> Nginx on EC2
  -> Gunicorn on 127.0.0.1:8000
  -> Django
  -> RDS PostgreSQL
```

## AWS Resources Created

Region:

```text
ap-south-1 Asia Pacific (Mumbai)
```

EC2:

```text
Instance purpose: Backend/API
Elastic IP: 65.0.40.184
OS: Ubuntu
Security group: trikonekt-prod-ec2-sg
Inbound:
  SSH 22
  HTTP 80
  HTTPS 443
```

RDS:

```text
DB identifier: trikonekt-prod-postgres
Engine: PostgreSQL
Class: db.t4g.micro
Region/AZ: ap-south-1c
Database name: trikonekt
Master user: trikonekt_admin
Public access: disabled
```

DNS:

```text
api.growth.vin A 65.0.40.184
```

Frontend DNS remains on Vercel:

```text
growth.vin
www.growth.vin
admin.growth.vin
```

## Repo Files Used

Deployment artifacts:

```text
deploy/aws/backend.env.example
deploy/aws/nginx-api-only-bootstrap.conf
deploy/aws/nginx-api-only.conf
deploy/aws/trikonekt-web.service
deploy/aws/trikonekt-worker.service
```

Frontend Vercel routing:

```text
frontend/vercel.json
```

The Vercel config routes API/media requests to AWS:

```text
/api/*     -> https://api.growth.vin/api/*
/media/*   -> https://api.growth.vin/media/*
/uploads/* -> https://api.growth.vin/uploads/*
```

## EC2 Access

SSH was tested using the Elastic IP:

```bash
ssh -i /path/to/trikonekt-prod-key.pem ubuntu@65.0.40.184
```

On Windows/Git Bash, the key path format is:

```bash
ssh -i "/c/Users/Baburaj/.ssh/trikonekt-prod-key.pem" ubuntu@65.0.40.184
```

Issue encountered:

```text
Bad permissions. UNPROTECTED PRIVATE KEY FILE.
```

Fix used:

```powershell
mkdir "$env:USERPROFILE\.ssh" -Force
copy "C:\Users\Baburaj\Downloads\trikonekt-prod-key.pem" "$env:USERPROFILE\.ssh\trikonekt-prod-key.pem"

$key="$env:USERPROFILE\.ssh\trikonekt-prod-key.pem"
$user=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
icacls $key /reset
icacls $key /inheritance:r
icacls $key /remove:g "Users" "Authenticated Users" "Everyone" "BUILTIN\Users" "BABURAJ\CodexSandboxUsers"
icacls $key /grant:r "$($user):(R)"
```

## Server Package Installation

Initial package command:

```bash
sudo apt update
sudo apt -y upgrade
sudo apt -y install nginx git curl unzip build-essential python3-venv python3-pip libpq-dev postgresql-client certbot python3-certbot-nginx fail2ban ufw
```

`python3.11-venv` was not available on the chosen Ubuntu image, so `python3-venv` was used instead.

Additional packages were required for `xhtml2pdf` and `pycairo`:

```bash
sudo apt update
sudo apt -y install pkg-config libcairo2-dev libpango1.0-dev libgdk-pixbuf-2.0-dev libffi-dev shared-mime-info
```

## Linux User and Firewall

Created application user and directories:

```bash
sudo adduser --system --group --home /srv/trikonekt trikonekt
sudo mkdir -p /srv/trikonekt/app /var/log/trikonekt /var/www/html
sudo chown -R trikonekt:trikonekt /srv/trikonekt /var/log/trikonekt
```

Enabled firewall and fail2ban:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo systemctl enable --now fail2ban
sudo ufw status
```

Observed firewall status:

```text
OpenSSH     ALLOW Anywhere
Nginx Full  ALLOW Anywhere
```

## Code Deployment

The project was cloned into:

```text
/srv/trikonekt/app
```

Correct final layout:

```text
/srv/trikonekt/app/backend
/srv/trikonekt/app/frontend
/srv/trikonekt/app/deploy
/srv/trikonekt/app/docs
```

A duplicate nested clone existed temporarily at:

```text
/srv/trikonekt/app/source
```

It was moved out of the app folder:

```bash
sudo mv /srv/trikonekt/app/source /srv/trikonekt/source_backup
```

After deployment artifacts were pushed to Git, the EC2 clone was updated:

```bash
sudo -u trikonekt bash -lc 'cd /srv/trikonekt/app && git pull'
```

Verified:

```bash
sudo ls -la /srv/trikonekt/app/deploy/aws
```

## Python Environment

Created and installed backend dependencies:

```bash
sudo -u trikonekt bash -lc 'cd /srv/trikonekt/app/backend && python3 -m venv .venv'
sudo -u trikonekt bash -lc 'cd /srv/trikonekt/app/backend && .venv/bin/pip install --upgrade pip'
sudo -u trikonekt bash -lc 'cd /srv/trikonekt/app/backend && .venv/bin/pip install -r requirements.txt'
```

The `pycairo` build initially failed because `pkg-config` and Cairo development libraries were missing. Installing the packages in the server package section fixed it.

## Production Environment File

Created:

```bash
sudo mkdir -p /etc/trikonekt
sudo cp /srv/trikonekt/app/deploy/aws/backend.env.example /etc/trikonekt/backend.env
sudo nano /etc/trikonekt/backend.env
```

Important AWS values:

```text
DEBUG=False
ALLOWED_HOSTS=api.growth.vin
DATABASE_URL=postgres://trikonekt_admin:<password>@<rds-endpoint>:5432/trikonekt?sslmode=require
DB_SSL_REQUIRE=True
SECURE_SSL_REDIRECT=False
```

Vercel/frontend origins:

```text
CSRF_TRUSTED_ORIGINS=https://growth.vin,https://www.growth.vin,https://admin.growth.vin,https://api.growth.vin
CORS_ALLOWED_ORIGINS=https://growth.vin,https://www.growth.vin,https://admin.growth.vin
CORS_ALLOWED_ORIGIN_REGEXES=^https://.*\.growth\.vin$,^https://.*\.vercel\.app$
```

Secrets copied privately from Render:

```text
SECRET_KEY
EMAIL_HOST
EMAIL_PORT
EMAIL_USE_TLS
EMAIL_HOST_USER
EMAIL_HOST_PASSWORD
DEFAULT_FROM_EMAIL
CLOUDINARY_URL
HUBBLE_CLIENT_ID
HUBBLE_CLIENT_SECRET
HUBBLE_APP_SECRET
HUBBLE_JWT_PRIVATE_KEY_PEM
HUBBLE_WEBHOOK_SECRET
```

Secured env file:

```bash
sudo chown root:trikonekt /etc/trikonekt/backend.env
sudo chmod 640 /etc/trikonekt/backend.env
```

Validated Django settings:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py check'
```

Result:

```text
System check identified no issues.
```

## Database Migration

Render export file:

```text
2026-05-27T07_12Z.dir.tar.gz
```

Uploaded from Git Bash:

```bash
scp -i "/c/Users/Baburaj/.ssh/trikonekt-prod-key.pem" "/c/Users/Baburaj/Downloads/2026-05-27T07_12Z.dir.tar.gz" ubuntu@65.0.40.184:/tmp/render-db.dir.tar.gz
```

Extracted on EC2:

```bash
mkdir -p /tmp/render-db-dir
tar -xzf /tmp/render-db.dir.tar.gz -C /tmp/render-db-dir
find /tmp/render-db-dir -maxdepth 3 -name toc.dat
```

Actual dump directory:

```text
/tmp/render-db-dir/2026-05-27T07:12Z/trikonekt_rn21
```

Restored to RDS:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; pg_restore --dbname "$DATABASE_URL" --format=directory --clean --if-exists --no-owner --no-acl "/tmp/render-db-dir/2026-05-27T07:12Z/trikonekt_rn21"'
```

Verified:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; psql "$DATABASE_URL" -c "\dt"'
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; psql "$DATABASE_URL" -c "select count(*) from accounts_customuser;"'
```

Observed user count:

```text
368
```

## Django Migration and Static Files

Ran:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py migrate --noinput'
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py collectstatic --noinput'
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py check'
```

Observed:

```text
No migrations to apply.
171 static files copied to '/srv/trikonekt/app/backend/staticfiles'.
System check identified no issues.
```

Warning observed:

```text
Your models in app(s): 'business' have changes that are not yet reflected in a migration.
```

This was not changed during production recovery. It should be reviewed later in development and committed as a proper migration if intended.

## systemd Services

Installed services:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/trikonekt-web.service /etc/systemd/system/trikonekt-web.service
sudo cp /srv/trikonekt/app/deploy/aws/trikonekt-worker.service /etc/systemd/system/trikonekt-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now trikonekt-web trikonekt-worker
```

Checked:

```bash
sudo systemctl status trikonekt-web --no-pager
sudo systemctl status trikonekt-worker --no-pager
```

Initial issue:

```text
trikonekt-web.service failed with result 'oom-kill'
trikonekt-worker.service failed with result 'oom-kill'
```

The EC2 instance had about 1 GB RAM and no swap:

```text
Swap: 0B
```

## Memory Fix

Added 2 GB swap:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

Reduced Gunicorn memory usage:

```bash
sudo nano /etc/systemd/system/trikonekt-web.service
```

Changed:

```text
--workers=2 --threads=2
```

to:

```text
--workers=1 --threads=2
```

Reloaded:

```bash
sudo systemctl daemon-reload
sudo systemctl restart trikonekt-web trikonekt-worker
```

Validated local health:

```bash
curl -I -H "Host: api.growth.vin" -H "X-Forwarded-Proto: https" http://127.0.0.1:8000/healthz
```

Result:

```text
HTTP/1.1 200 OK
```

## Nginx Setup

Installed API-only bootstrap config:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/nginx-api-only-bootstrap.conf /etc/nginx/sites-available/trikonekt-api
sudo ln -sfn /etc/nginx/sites-available/trikonekt-api /etc/nginx/sites-enabled/trikonekt-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

HTTP health check before SSL:

```bash
curl -I http://api.growth.vin/healthz
```

Observed:

```text
HTTP/1.1 301 Moved Permanently
```

## DNS Cutover

GoDaddy DNS was updated.

Old value:

```text
api.growth.vin -> Render / onrender.com
```

New value:

```text
Type: A
Name: api
Value: 65.0.40.184
TTL: 1/2 Hour
```

Validation command:

```bash
nslookup api.growth.vin
```

Expected after propagation:

```text
Address: 65.0.40.184
```

## SSL Setup

Certificate was issued with:

```bash
sudo certbot certonly --webroot -w /var/www/html -d api.growth.vin
```

Certificate result:

```text
Certificate is saved at: /etc/letsencrypt/live/api.growth.vin/fullchain.pem
Key is saved at: /etc/letsencrypt/live/api.growth.vin/privkey.pem
```

Issue encountered:

```text
open() "/etc/letsencrypt/options-ssl-nginx.conf" failed
```

Cause:

```text
Final SSL Nginx config was copied before Certbot's Nginx plugin created shared SSL files.
```

Fix:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/nginx-api-only-bootstrap.conf /etc/nginx/sites-available/trikonekt-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d api.growth.vin
```

Chose reinstall existing certificate when prompted.

Certbot result:

```text
Successfully deployed certificate for api.growth.vin
HTTPS enabled on https://api.growth.vin
```

## Nginx HTTPS Proxy Header Fix

After SSL, `https://api.growth.vin/healthz` returned:

```text
HTTP/1.1 301 Moved Permanently
Location: https://api.growth.vin/healthz
```

Cause:

```text
Nginx was still forwarding X-Forwarded-Proto as http, causing Django HTTPS redirect loop.
```

Active config contained:

```nginx
proxy_set_header X-Forwarded-Proto http;
```

Fixed:

```bash
sudo sed -i 's/proxy_set_header X-Forwarded-Proto http;/proxy_set_header X-Forwarded-Proto https;/' /etc/nginx/sites-available/trikonekt-api
sudo nginx -t
sudo systemctl reload nginx
```

Expected final health:

```bash
curl -I https://api.growth.vin/healthz
```

```text
HTTP/1.1 200 OK
```

## Final Validation Commands

API health:

```bash
curl -I https://api.growth.vin/healthz
```

Django admin:

```text
https://api.growth.vin/admin/
```

Services:

```bash
sudo systemctl status trikonekt-web --no-pager
sudo systemctl status trikonekt-worker --no-pager
```

Logs:

```bash
sudo journalctl -u trikonekt-web -f
sudo journalctl -u trikonekt-worker -f
sudo tail -f /var/log/nginx/trikonekt-api.error.log
```

Memory:

```bash
free -h
```

Database:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; psql "$DATABASE_URL" -c "select count(*) from accounts_customuser;"'
```

## Operational Notes

Old Render backend:

- Keep temporarily for rollback.
- Do not allow old Render worker and AWS worker to process jobs at the same time.
- Stop/suspend Render worker after AWS worker is confirmed healthy.

Backups:

- Take an RDS manual snapshot after successful cutover.
- Keep the original Render dump until production is fully validated.

Recommended immediate checks:

- login
- admin login
- OTP/email
- payment/webhook callbacks
- file uploads and media URLs
- wallet flows
- coupon flows
- invoice/PDF downloads
- browser Network tab shows API calls to `https://api.growth.vin`

## GitHub Actions Auto Deploy

Auto deploy was added after the manual migration.

Files:

```text
.github/workflows/deploy-backend-aws.yml
deploy/aws/deploy-backend.sh
```

Behavior:

- Runs on push to `main`.
- Runs only when backend/deploy workflow files change.
- Can also be run manually from GitHub Actions with `workflow_dispatch`.
- SSHes into EC2.
- Runs `git pull`.
- Installs backend Python dependencies.
- Runs migrations.
- Runs `collectstatic`.
- Restarts `trikonekt-web` and `trikonekt-worker`.
- Verifies `https://api.growth.vin/healthz`.

Required GitHub repository secrets:

```text
AWS_EC2_HOST=65.0.40.184
AWS_EC2_USER=ubuntu
AWS_EC2_SSH_KEY=<contents of trikonekt-prod-key.pem>
```

Add them in GitHub:

```text
Repository > Settings > Secrets and variables > Actions > New repository secret
```

Do not commit the `.pem` file.

First-time setup on EC2:

```bash
sudo -u trikonekt bash -lc 'cd /srv/trikonekt/app && git pull'
```

This is needed once so the EC2 clone has the new workflow support files before the first GitHub Actions deploy. The workflow runs the deploy script with `sudo` because `/srv/trikonekt/app` is owned by the `trikonekt` user.

Manual deploy command on EC2 remains:

```bash
sudo env DEPLOY_BRANCH=main bash /srv/trikonekt/app/deploy/aws/deploy-backend.sh
```

## Rollback

If AWS backend fails:

1. Point GoDaddy `api` DNS record back to Render.
2. Stop AWS worker:

```bash
sudo systemctl stop trikonekt-worker
```

3. Optionally stop AWS web:

```bash
sudo systemctl stop trikonekt-web
```

4. Compare any writes made during the AWS window before attempting another cutover.

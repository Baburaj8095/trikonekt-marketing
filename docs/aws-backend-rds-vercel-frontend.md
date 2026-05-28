# AWS Backend + RDS Migration With Vercel Frontend

Use this guide when the React frontend remains deployed on Vercel and only the backend/API plus database move from Render to AWS.

Target architecture:

- Frontend: Vercel stays active
- Backend/API: AWS EC2 Ubuntu 22.04
- Database: AWS RDS PostgreSQL
- Process manager: systemd for Django web and worker
- Reverse proxy: Nginx on EC2 for `api.growth.vin`
- SSL: Let's Encrypt on EC2 for `api.growth.vin`
- Media: keep Cloudinary if `CLOUDINARY_URL` exists in Render

The current `frontend/vercel.json` already proxies these paths to AWS API:

```text
/api/*     -> https://api.growth.vin/api/*
/media/*   -> https://api.growth.vin/media/*
/uploads/* -> https://api.growth.vin/uploads/*
```

Do not share AWS keys, `.pem` keys, database passwords, Render env values, or app secrets in chat.

## Phase 1: Create AWS Network and Server

1. Log in to AWS Console.
2. Select one region, recommended:

```text
ap-south-1 Asia Pacific (Mumbai)
```

3. Go to `EC2 > Security Groups > Create security group`.
4. Create EC2 security group:

```text
Name: trikonekt-prod-ec2-sg
VPC: default VPC
Inbound:
  SSH    22   your IP only
  HTTP   80   0.0.0.0/0
  HTTPS  443  0.0.0.0/0
Outbound:
  All traffic
```

5. Go to `EC2 > Key pairs > Create key pair`.
6. Create and download:

```text
Name: trikonekt-prod-key
Type: RSA
Format: .pem
```

7. Go to `EC2 > Instances > Launch instances`.
8. Launch:

```text
Name: trikonekt-prod-api
AMI: Ubuntu Server 22.04 LTS
Instance type: t3.micro or t3.small
Key pair: trikonekt-prod-key
Security group: trikonekt-prod-ec2-sg
Storage: 25 GiB gp3
Public IP: enabled
```

9. Allocate and associate an Elastic IP:

```text
EC2 > Elastic IPs > Allocate Elastic IP > Associate to trikonekt-prod-api
```

Keep the Elastic IP; this becomes the DNS target for `api.growth.vin`.

## Phase 2: Create RDS PostgreSQL

1. Go to `EC2 > Security Groups > Create security group`.
2. Create RDS security group:

```text
Name: trikonekt-prod-rds-sg
VPC: same VPC as EC2
Inbound:
  PostgreSQL 5432 from trikonekt-prod-ec2-sg
Outbound:
  All traffic
```

3. Go to `RDS > Databases > Create database`.
4. Choose:

```text
Creation method: Standard create
Engine: PostgreSQL
Template: Free tier if available, otherwise Dev/Test
DB identifier: trikonekt-prod-postgres
Master username: trikonekt_admin
Master password: save privately
Instance class: db.t3.micro or db.t4g.micro where available
Storage: 20 GiB minimum
Storage autoscaling: enabled
Public access: No
Security group: trikonekt-prod-rds-sg
Initial database name: trikonekt
Backup retention: 7 days
Deletion protection: enabled
```

5. Wait until RDS status is `Available`.
6. Copy the RDS endpoint.

Your AWS database URL format:

```text
postgres://trikonekt_admin:<password>@<rds-endpoint>:5432/trikonekt?sslmode=require
```

## Phase 3: Prepare EC2

SSH into EC2:

```bash
ssh -i trikonekt-prod-key.pem ubuntu@<elastic-ip>
```

Install packages:

```bash
sudo apt update
sudo apt -y upgrade
sudo apt -y install nginx git curl unzip build-essential python3.11-venv python3-pip libpq-dev postgresql-client certbot python3-certbot-nginx fail2ban ufw
```

Create app user:

```bash
sudo adduser --system --group --home /srv/trikonekt trikonekt
sudo mkdir -p /srv/trikonekt/app /var/log/trikonekt /var/www/html
sudo chown -R trikonekt:trikonekt /srv/trikonekt /var/log/trikonekt
```

Enable firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo systemctl enable --now fail2ban
```

## Phase 4: Deploy Backend Code

Clone the repo:

```bash
sudo -u trikonekt git clone <repo-url> /srv/trikonekt/app
```

Install Python dependencies:

```bash
cd /srv/trikonekt/app/backend
sudo -u trikonekt python3 -m venv .venv
sudo -u trikonekt .venv/bin/pip install --upgrade pip
sudo -u trikonekt .venv/bin/pip install -r requirements.txt
```

Create backend env file:

```bash
sudo mkdir -p /etc/trikonekt
sudo cp /srv/trikonekt/app/deploy/aws/backend.env.example /etc/trikonekt/backend.env
sudo nano /etc/trikonekt/backend.env
```

Use your Render env values, but change these for AWS:

```text
DEBUG=False
DATABASE_URL=postgres://trikonekt_admin:<password>@<rds-endpoint>:5432/trikonekt?sslmode=require
ALLOWED_HOSTS=api.growth.vin
CSRF_TRUSTED_ORIGINS=https://growth.vin,https://www.growth.vin,https://admin.growth.vin,https://api.growth.vin,https://<your-vercel-domain>.vercel.app
CORS_ALLOWED_ORIGINS=https://growth.vin,https://www.growth.vin,https://admin.growth.vin,https://<your-vercel-domain>.vercel.app
CORS_ALLOWED_ORIGIN_REGEXES=^https://.*\.growth\.vin$,^https://.*\.vercel\.app$
SECURE_SSL_REDIRECT=False
DB_SSL_REQUIRE=True
```

If Vercel production uses only `growth.vin`, `www.growth.vin`, and `admin.growth.vin`, you may omit the Vercel preview domain from `CORS_ALLOWED_ORIGINS`. Keep the regex if you use Vercel preview deployments.

Secure the env file:

```bash
sudo chown root:trikonekt /etc/trikonekt/backend.env
sudo chmod 640 /etc/trikonekt/backend.env
```

## Phase 5: Restore Render Database Dump to AWS RDS

Upload your Render dump from your local machine:

```bash
scp -i trikonekt-prod-key.pem render-prod.dump ubuntu@<elastic-ip>:/tmp/render-prod.dump
```

If your file is `.sql`, upload it as:

```bash
scp -i trikonekt-prod-key.pem render-prod.sql ubuntu@<elastic-ip>:/tmp/render-prod.sql
```

On EC2, set the AWS DB URL:

```bash
export AWS_DATABASE_URL='postgres://trikonekt_admin:<password>@<rds-endpoint>:5432/trikonekt?sslmode=require'
```

Restore `.dump`:

```bash
pg_restore --dbname "$AWS_DATABASE_URL" --clean --if-exists --no-owner --no-acl /tmp/render-prod.dump
```

Restore `.sql`:

```bash
psql "$AWS_DATABASE_URL" < /tmp/render-prod.sql
```

Verify:

```bash
psql "$AWS_DATABASE_URL" -c "\dt"
psql "$AWS_DATABASE_URL" -c "select count(*) from accounts_customuser;"
```

Remove dump after successful import:

```bash
rm -f /tmp/render-prod.dump /tmp/render-prod.sql
```

## Phase 6: Run Django Setup

Run migrations and collect static:

```bash
cd /srv/trikonekt/app/backend
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; .venv/bin/python manage.py migrate --noinput'
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; .venv/bin/python manage.py collectstatic --noinput'
```

Check Django config:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py check --deploy'
```

## Phase 7: Start Backend and Worker

Install systemd services:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/trikonekt-web.service /etc/systemd/system/trikonekt-web.service
sudo cp /srv/trikonekt/app/deploy/aws/trikonekt-worker.service /etc/systemd/system/trikonekt-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now trikonekt-web trikonekt-worker
```

Check:

```bash
sudo systemctl status trikonekt-web --no-pager
sudo systemctl status trikonekt-worker --no-pager
curl -I http://127.0.0.1:8000/healthz
```

Logs:

```bash
sudo journalctl -u trikonekt-web -f
sudo journalctl -u trikonekt-worker -f
```

## Phase 8: Configure Nginx for API Only

Install temporary HTTP config:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/nginx-api-only-bootstrap.conf /etc/nginx/sites-available/trikonekt-api
sudo ln -sfn /etc/nginx/sites-available/trikonekt-api /etc/nginx/sites-enabled/trikonekt-api
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Test through HTTP before DNS:

```bash
curl -I http://<elastic-ip>/healthz
```

## Phase 9: Point API DNS to AWS

In your DNS provider, update only:

```text
api.growth.vin  A  <elastic-ip>
```

Keep frontend DNS pointing to Vercel:

```text
growth.vin
www.growth.vin
admin.growth.vin
```

Wait for DNS:

```bash
nslookup api.growth.vin
```

It should return the EC2 Elastic IP.

## Phase 10: Enable SSL for API

Run on EC2:

```bash
sudo certbot certonly --webroot -w /var/www/html -d api.growth.vin
sudo cp /srv/trikonekt/app/deploy/aws/nginx-api-only.conf /etc/nginx/sites-available/trikonekt-api
sudo nginx -t
sudo systemctl reload nginx
sudo certbot renew --dry-run
```

Verify:

```bash
curl -I https://api.growth.vin/healthz
curl -I https://api.growth.vin/admin/
```

## Phase 11: Vercel Frontend Settings

In Vercel:

1. Open the frontend project.
2. Confirm production domains still point to Vercel:

```text
growth.vin
www.growth.vin
admin.growth.vin
```

3. Confirm `frontend/vercel.json` is deployed.
4. If you use an explicit env var, set:

```text
REACT_APP_API_URL=https://api.growth.vin/api
```

If no `REACT_APP_API_URL` is set, the app uses `/api/`, and Vercel rewrites `/api/*` to `https://api.growth.vin/api/*`.

Redeploy Vercel only if you changed env vars or `vercel.json`.

## Phase 12: Final Cutover From Render

Do this when AWS API works on a test DB restore.

1. Disable Render auto-deploys.
2. Pause writes briefly if possible.
3. Download a fresh Render PostgreSQL dump.
4. Upload it to EC2.
5. Restore it to RDS again.
6. Restart AWS services:

```bash
sudo systemctl restart trikonekt-web trikonekt-worker
```

7. Change `api.growth.vin` DNS from Render to EC2 Elastic IP.
8. Keep Render backend available for rollback, but stop Render worker or AWS worker so both do not process the same live jobs.

## Phase 13: End-to-End Validation

Test from the Vercel frontend:

- public home page loads
- login works
- token refresh/session persistence works
- admin login works
- OTP/password reset email works
- wallet screens load
- coupon activation/redeem works
- payment proof upload works
- Hubble/gift card APIs work
- payment/webhook callbacks point to `https://api.growth.vin`
- file/media URLs load
- PDF/invoice downloads work
- mobile views work
- browser Network tab has no Render API calls

Server checks:

```bash
curl -I https://api.growth.vin/healthz
sudo journalctl -u trikonekt-web -n 100 --no-pager
sudo journalctl -u trikonekt-worker -n 100 --no-pager
sudo tail -n 100 /var/log/nginx/trikonekt-api.error.log
```

Database check:

```bash
psql "$AWS_DATABASE_URL" -c "select count(*) from accounts_customuser;"
```

## Phase 14: Rollback

If AWS backend fails:

1. Point `api.growth.vin` DNS back to Render.
2. Stop AWS worker:

```bash
sudo systemctl stop trikonekt-worker
```

3. Optionally stop AWS web:

```bash
sudo systemctl stop trikonekt-web
```

4. Investigate logs and compare any writes made during the AWS window.

## Phase 15: Backup

Before major changes, take an RDS snapshot:

```text
RDS > Databases > trikonekt-prod-postgres > Actions > Take snapshot
```

Manual logical backup:

```bash
pg_dump "$AWS_DATABASE_URL" --format=custom --no-owner --no-acl --file=/tmp/trikonekt-backup.dump
```

Restore:

```bash
pg_restore --dbname "$AWS_DATABASE_URL" --clean --if-exists --no-owner --no-acl /tmp/trikonekt-backup.dump
```

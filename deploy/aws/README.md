# Trikonekt AWS Deployment Guide From Zero

This guide starts from only having an AWS account. It deploys the current Trikonekt app from Render to AWS using:

- EC2 Ubuntu 22.04 for frontend + backend
- Nginx for frontend hosting and reverse proxy
- Gunicorn + systemd for Django backend
- systemd for Django background worker
- RDS PostgreSQL for database
- Let's Encrypt SSL
- Cloudinary kept for uploads if `CLOUDINARY_URL` exists in your Render env

If you want to keep the frontend on Vercel and migrate only backend/API + database to AWS, use:

```text
docs/aws-backend-rds-vercel-frontend.md
```

Do not paste AWS keys, `.pem` keys, database passwords, `SECRET_KEY`, email passwords, or payment/Hubble secrets into chat or Git.

## 0. What You Need Before Starting

You need:

- AWS account login
- Domain DNS access for `growth.vin`
- Render PostgreSQL dump file downloaded
- Render environment variables copied privately
- Git repository URL for this project
- Your computer's public IP address for SSH allowlisting

Check your public IP:

```bash
curl ifconfig.me
```

Use PostgreSQL RDS, not MySQL. This Django app already uses PostgreSQL through `DATABASE_URL`, `psycopg2-binary`, and Render PostgreSQL.

## 1. Choose AWS Region

In AWS Console, top-right region selector:

```text
Asia Pacific (Mumbai) ap-south-1
```

Use one region for everything: EC2, RDS, Elastic IP, security groups.

## 2. Create EC2 Security Group

Go to:

```text
AWS Console > EC2 > Security Groups > Create security group
```

Create:

```text
Security group name: trikonekt-prod-ec2-sg
Description: Trikonekt production EC2 web server
VPC: default VPC
```

Inbound rules:

```text
SSH        TCP 22   Your IP only, for example 203.0.113.10/32
HTTP       TCP 80   0.0.0.0/0
HTTPS      TCP 443  0.0.0.0/0
```

Outbound rules:

```text
All traffic  All  0.0.0.0/0
```

Do not open:

```text
8000
5432
3000
```

## 3. Create EC2 Key Pair

Go to:

```text
EC2 > Key pairs > Create key pair
```

Use:

```text
Name: trikonekt-prod-key
Type: RSA
Format: .pem
```

Download and store the `.pem` file safely. AWS will not let you download it again.

On Mac/Linux, secure the file:

```bash
chmod 400 trikonekt-prod-key.pem
```


ssh -i C:\Users\Baburaj\Downloads\trikonekt-prod-key.pem ubuntu@YOUR_EC2_IP

On Windows PowerShell, use the key path directly when connecting.

## 4. Launch EC2 Instance

Go to:

```text
EC2 > Instances > Launch instances
```

Set:

```text
Name: trikonekt-prod-web
AMI: Ubuntu Server 22.04 LTS
Architecture: x86_64
Instance type: t3.micro for Free Tier where eligible, or t3.small/t4g.micro if needed
Key pair: trikonekt-prod-key
Network: default VPC
Subnet: any public subnet
Auto-assign public IP: Enable
Security group: trikonekt-prod-ec2-sg
Storage: 25 GiB gp3
```

Launch the instance.

Wait until:

```text
Instance state: Running
Status checks: 2/2 checks passed
```

## 5. Allocate Elastic IP

Go to:

```text
EC2 > Elastic IPs > Allocate Elastic IP address
```

Choose:

```text
Network border group: ap-south-1
```

Then:

```text
Actions > Associate Elastic IP address
Resource type: Instance
Instance: trikonekt-prod-web
```

Write down:

```text
EC2_ELASTIC_IP=<your-elastic-ip>
```

Important: An unattached Elastic IP can cost money. Keep it attached or release it.

## 6. Create RDS Security Group

Go to:

```text
EC2 > Security Groups > Create security group
```

Create:

```text
Security group name: trikonekt-prod-rds-sg
Description: Trikonekt production RDS PostgreSQL
VPC: same default VPC as EC2
```

Inbound rule:

```text
PostgreSQL  TCP 5432  Source: trikonekt-prod-ec2-sg
```

Outbound:

```text
All traffic  All  0.0.0.0/0
```

Do not allow `5432` from `0.0.0.0/0`.

## 7. Create RDS PostgreSQL Database

Go to:

```text
RDS > Databases > Create database
```

Choose:

```text
Creation method: Standard create
Engine: PostgreSQL
Template: Free tier if available, otherwise Dev/Test for initial migration
DB instance identifier: trikonekt-prod-postgres
Master username: trikonekt_admin
Master password: create a strong password and save privately
DB instance class: db.t3.micro or db.t4g.micro where available
Storage type: gp3 or General Purpose SSD
Allocated storage: 20 GiB minimum
Storage autoscaling: enabled
VPC: same VPC as EC2
Public access: No
VPC security group: trikonekt-prod-rds-sg
Initial database name: trikonekt
Backup retention: 7 days
Deletion protection: enabled
```

Create database.

Wait until:

```text
Status: Available
```

Open the database details and copy:

```text
RDS_ENDPOINT=<rds-endpoint>
```

Your RDS database URL format:

```text
postgres://trikonekt_admin:<RDS_PASSWORD>@<RDS_ENDPOINT>:5432/trikonekt?sslmode=require
```

Save this privately. You will put it into `/etc/trikonekt/backend.env` later.

## 8. Connect to EC2

From your local machine:

```bash
ssh -i trikonekt-prod-key.pem ubuntu@<EC2_ELASTIC_IP>
```

If using Windows PowerShell:

```powershell
ssh -i C:\path\to\trikonekt-prod-key.pem ubuntu@<EC2_ELASTIC_IP>
```

If SSH fails:

- Check EC2 security group allows port `22` from your current IP.
- Check the instance is running.
- Check you are using user `ubuntu`.

## 9. Install Server Packages

Run on EC2:

```bash
sudo apt update
sudo apt -y upgrade
sudo apt -y install nginx git curl unzip build-essential python3.11-venv python3-pip libpq-dev postgresql-client certbot python3-certbot-nginx fail2ban ufw
```

Install Node.js 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs
```

Check versions:

```bash
python3 --version
node --version
npm --version
psql --version
nginx -v
```

## 10. Create Linux App User

Run on EC2:

```bash
sudo adduser --system --group --home /srv/trikonekt trikonekt
sudo mkdir -p /srv/trikonekt/app /var/log/trikonekt /var/www/html
sudo chown -R trikonekt:trikonekt /srv/trikonekt /var/log/trikonekt
```

## 11. Enable Basic Firewall and Fail2ban

Run on EC2:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo systemctl enable --now fail2ban
```

Check:

```bash
sudo ufw status
sudo systemctl status fail2ban --no-pager
```

## 12. Clone Project on EC2

Run on EC2:

```bash
sudo -u trikonekt git clone <YOUR_REPOSITORY_URL> /srv/trikonekt/app
cd /srv/trikonekt/app
```

If the repo is private, use one of these:

- GitHub deploy key
- GitHub fine-scoped personal access token
- Upload a ZIP release to EC2 and unzip it

Do not put GitHub tokens into the README or shell history if avoidable.

## 13. Create Production Backend Env File

Run on EC2:

```bash
sudo mkdir -p /etc/trikonekt
sudo cp /srv/trikonekt/app/deploy/aws/backend.env.example /etc/trikonekt/backend.env
sudo nano /etc/trikonekt/backend.env
```

Fill values from Render env, but update these for AWS:

```text
DEBUG=False
DATABASE_URL=postgres://trikonekt_admin:<RDS_PASSWORD>@<RDS_ENDPOINT>:5432/trikonekt?sslmode=require
ALLOWED_HOSTS=growth.vin,www.growth.vin,admin.growth.vin,api.growth.vin
CSRF_TRUSTED_ORIGINS=https://growth.vin,https://www.growth.vin,https://admin.growth.vin,https://api.growth.vin
CORS_ALLOWED_ORIGINS=https://growth.vin,https://www.growth.vin,https://admin.growth.vin
SECURE_SSL_REDIRECT=False
DB_SSL_REQUIRE=True
```

Keep the same Render values for:

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

If `CLOUDINARY_URL` was set on Render, keep it. That avoids moving media during the first migration.

Secure the env file:

```bash
sudo chown root:trikonekt /etc/trikonekt/backend.env
sudo chmod 640 /etc/trikonekt/backend.env
```

## 14. Install Backend Dependencies

Run on EC2:

```bash
cd /srv/trikonekt/app/backend
sudo -u trikonekt python3 -m venv .venv
sudo -u trikonekt .venv/bin/pip install --upgrade pip
sudo -u trikonekt .venv/bin/pip install -r requirements.txt
```

## 15. Upload Render DB Dump to EC2

From your local machine, not inside EC2:

For `.dump` file:

```bash
scp -i trikonekt-prod-key.pem render-prod.dump ubuntu@<EC2_ELASTIC_IP>:/tmp/render-prod.dump
```

For `.sql` file:

```bash
scp -i trikonekt-prod-key.pem render-prod.sql ubuntu@<EC2_ELASTIC_IP>:/tmp/render-prod.sql
```

Then SSH back into EC2.

## 16. Import Render DB Dump Into RDS

On EC2, create a temporary DB URL variable:

```bash
export AWS_DATABASE_URL='postgres://trikonekt_admin:<RDS_PASSWORD>@<RDS_ENDPOINT>:5432/trikonekt?sslmode=require'
```

If your file is `.dump`:

```bash
pg_restore --dbname "$AWS_DATABASE_URL" --clean --if-exists --no-owner --no-acl /tmp/render-prod.dump
```

If your file is `.sql`:

```bash
psql "$AWS_DATABASE_URL" < /tmp/render-prod.sql
```

Verify tables:

```bash
psql "$AWS_DATABASE_URL" -c "\dt"
psql "$AWS_DATABASE_URL" -c "select count(*) from accounts_customuser;"
```

After import succeeds, remove the dump from EC2:

```bash
rm -f /tmp/render-prod.dump /tmp/render-prod.sql
```

## 17. Run Django Migrations and Static Collection

Run on EC2:

```bash
cd /srv/trikonekt/app/backend
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; .venv/bin/python manage.py migrate --noinput'
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; .venv/bin/python manage.py collectstatic --noinput'
```

Check Django health locally:

```bash
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; cd /srv/trikonekt/app/backend && .venv/bin/python manage.py check --deploy'
```

Some `check --deploy` warnings may be acceptable because SSL redirect is handled by Nginx.

## 18. Build React Frontend

Run on EC2:

```bash
cd /srv/trikonekt/app/frontend
sudo -u trikonekt npm ci
sudo -u trikonekt npm run build
```

Do not set `REACT_APP_API_URL` for this EC2 deployment. The React app defaults to `/api/`, and Nginx proxies `/api/` to Django.

## 19. Install systemd Services

Run on EC2:

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

View logs:

```bash
sudo journalctl -u trikonekt-web -f
sudo journalctl -u trikonekt-worker -f
```

## 20. Install Temporary Nginx Config

Run on EC2:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/nginx-trikonekt-bootstrap.conf /etc/nginx/sites-available/trikonekt
sudo ln -sfn /etc/nginx/sites-available/trikonekt /etc/nginx/sites-enabled/trikonekt
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Test using Elastic IP:

```bash
curl -I http://<EC2_ELASTIC_IP>/healthz
```

The frontend may not fully work by IP if domain-specific routing is expected. That is okay.

## 21. Point DNS to AWS

In your domain DNS provider, create or update A records:

```text
growth.vin        A    <EC2_ELASTIC_IP>
www.growth.vin    A    <EC2_ELASTIC_IP>
admin.growth.vin  A    <EC2_ELASTIC_IP>
api.growth.vin    A    <EC2_ELASTIC_IP>
```

Use low TTL during migration:

```text
TTL: 300 seconds
```

Check DNS:

```bash
nslookup growth.vin
nslookup api.growth.vin
```

Wait until they resolve to the Elastic IP.

## 22. Enable Let's Encrypt SSL

Run on EC2 after DNS points to EC2:

```bash
sudo certbot certonly --webroot -w /var/www/html -d growth.vin -d www.growth.vin -d admin.growth.vin -d api.growth.vin
```

Install final HTTPS Nginx config:

```bash
sudo cp /srv/trikonekt/app/deploy/aws/nginx-trikonekt.conf /etc/nginx/sites-available/trikonekt
sudo nginx -t
sudo systemctl reload nginx
```

Test auto-renew:

```bash
sudo certbot renew --dry-run
```

## 23. Verify Production URLs

Run:

```bash
curl -I https://growth.vin/
curl -I https://www.growth.vin/
curl -I https://admin.growth.vin/
curl -I https://api.growth.vin/healthz
curl -I https://api.growth.vin/admin/
```

Expected:

- frontend routes return `200`
- `/healthz` returns success
- `api.growth.vin/admin/` loads Django admin
- `admin.growth.vin/` loads React admin UI

## 24. Update External Webhooks and API URLs

In external providers, update webhook URLs from Render to AWS:

```text
https://api.growth.vin/...
```

Check:

- payment provider webhooks
- Hubble webhooks
- OTP/email callback settings if any
- allowed origins/callback URLs in third-party dashboards

## 25. Final Render Cutover With Minimal Downtime

Do this when AWS test deployment works.

1. Reduce DNS TTL to `300` at least a few hours before cutover.
2. Disable Render auto-deploys.
3. Stop new writes briefly if possible.
4. Download a fresh final PostgreSQL dump from Render.
5. Upload fresh dump to EC2.
6. Restore fresh dump into RDS again.
7. Run migrations again:

```bash
cd /srv/trikonekt/app/backend
sudo -u trikonekt bash -lc 'set -a; source /etc/trikonekt/backend.env; set +a; .venv/bin/python manage.py migrate --noinput'
sudo systemctl restart trikonekt-web trikonekt-worker
```

8. Point DNS to EC2 Elastic IP.
9. Validate production.
10. Keep Render services available for rollback, but do not let Render worker and AWS worker both process the same production database.

## 26. Full Validation Checklist

Test:

- Home page
- User login
- Admin login
- Token refresh/session persistence
- OTP/password reset email
- User dashboard
- Admin dashboard
- Wallet flows
- Coupon activation/redeem
- Prime/package purchase approval
- Rank upgrades
- Hubble/gift card integration
- Payment proof upload
- File/media uploads
- PDF/invoice download
- Marketplace/products
- Mobile responsive pages
- Browser network tab has no Render URLs
- Backend logs have no Render database hostname

Useful logs:

```bash
sudo journalctl -u trikonekt-web -f
sudo journalctl -u trikonekt-worker -f
sudo tail -f /var/log/nginx/trikonekt-frontend.access.log
sudo tail -f /var/log/nginx/trikonekt-api.error.log
```

## 27. Backup and Restore

Create manual RDS snapshot before major changes:

```text
RDS > Databases > trikonekt-prod-postgres > Actions > Take snapshot
```

Create logical backup from EC2:

```bash
export AWS_DATABASE_URL='postgres://trikonekt_admin:<RDS_PASSWORD>@<RDS_ENDPOINT>:5432/trikonekt?sslmode=require'
pg_dump "$AWS_DATABASE_URL" --format=custom --no-owner --no-acl --file=/tmp/trikonekt-backup.dump
```

Restore:

```bash
pg_restore --dbname "$AWS_DATABASE_URL" --clean --if-exists --no-owner --no-acl /tmp/trikonekt-backup.dump
```

## 28. Rollback Plan

If AWS fails after cutover:

1. Point DNS records back to Render.
2. Stop AWS worker immediately:

```bash
sudo systemctl stop trikonekt-worker
```

3. Keep AWS web running only for investigation or stop it:

```bash
sudo systemctl stop trikonekt-web
```

4. Compare any writes made during the AWS window before another migration attempt.

## 29. Common Errors

`permission denied publickey`

- Wrong `.pem`
- Wrong user; use `ubuntu`
- SSH rule does not allow your current IP

`could not connect to server: Connection timed out` for RDS

- RDS security group does not allow EC2 security group
- RDS and EC2 are in different VPCs
- Wrong RDS endpoint

`nginx -t` fails before SSL

- Use `nginx-trikonekt-bootstrap.conf` first
- Run Certbot
- Then switch to `nginx-trikonekt.conf`

Frontend loads but API fails

- Check `https://api.growth.vin/healthz`
- Check CORS env values
- Check Nginx `/api/` proxy
- Check `journalctl -u trikonekt-web`

Admin React route opens Django admin

- Use `admin.growth.vin` for React admin UI
- Use `api.growth.vin/admin/` for Django admin

## 30. Optional Later Improvements

After first successful migration:

- Move media from Cloudinary/local disk to S3 using `django-storages`
- Add CloudWatch agent for memory/disk/logs
- Add Route 53 health checks
- Enable GitHub Actions auto deploy using `.github/workflows/deploy-backend-aws.yml`
- Move from single EC2 to ECS/Fargate or Auto Scaling when traffic grows
- Put RDS in private subnets in a dedicated production VPC

## Official References

- EC2 launch and instance basics: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-launch-parameters.html
- EC2 Free Tier tracking: https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
- RDS DB creation: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_CreateDBInstance.html
- RDS security groups: https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.RDSSecurityGroups.html

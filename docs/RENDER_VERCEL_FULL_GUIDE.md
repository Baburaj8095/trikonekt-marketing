# Complete Hosting Guide: Render (Django + Postgres) + Vercel (React) + Namecheap DNS

This guide provides a complete, click-by-click setup to deploy:
- Backend API (Django, Gunicorn) on Render with PostgreSQL
- Frontend (React) on Vercel
- Custom domains on Namecheap:
  - Frontend: https://trikonekt.com
  - Backend: https://api.trikonekt.com

The repository is already prepared:
- Postgres support via dj-database-url with SQLite fallback
- WhiteNoise for static files
- Production security flags (proxy-aware)
- Management command to reset DB sequences after data import
- Render blueprint (render.yaml)
- Vercel config (vercel.json) and frontend/.env.production
- Guides: docs/MIGRATION.md, docs/DEPLOY_RENDER_VERCEL.md, docs/NAMECHEAP_DNS.md

Use this full guide as your “single source” with every step end‑to‑end.

--------------------------------------------------------------------------------

## 0) Prerequisites

- Accounts:
  - GitHub (or GitLab/Bitbucket) for source hosting
  - Render account
  - Vercel account
  - Namecheap access for DNS

- Local environment (Windows recommended steps included):
  - Python 3.11+ (you’re on Python 3.13)
  - Node 18+ for React build
  - Virtualenv created and dependencies installed:
    - Windows:
      - py -3 -m venv .venv
      - .venv\Scripts\activate
      - pip install -r backend\requirements.txt

- This repository includes:
  - backend/core/settings.py configured for DATABASE_URL + WhiteNoise
  - backend/requirements.txt includes psycopg2-binary, dj-database-url, whitenoise, gunicorn
  - frontend/.env.production with REACT_APP_API_URL=https://api.trikonekt.com/api
  - frontend/vercel.json for SPA routing
  - render.yaml blueprint
  - docs/NAMECHEAP_DNS.md with exact DNS records for Namecheap

--------------------------------------------------------------------------------

## 1) Push your repository to GitHub

If not already on GitHub:

```
git init
git add .
git commit -m "Prepare Render + Vercel deploy"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo>.git
git push -u origin main
```

--------------------------------------------------------------------------------

## 2) Database path (choose one)

You already migrated SQLite data to Render Postgres locally using the External DATABASE_URL. Pick ONE option to use in Render:

- Option A (Recommended) — Use the same Postgres you imported data into:
  - In Render Web Service settings, set env var DATABASE_URL to the same External connection string.
  - Do NOT create a new/empty DB.

- Option B — Create a fresh Postgres via Blueprint (render.yaml):
  - The blueprint will create trikonekt-db and auto-attach DATABASE_URL.
  - If you want your local SQLite data, re-import into this new DB:
    1) Copy its External connection string
    2) Locally: set DATABASE_URL, run manage.py migrate, loaddata, reset_sequences (see docs/MIGRATION.md)

Recommendation: If your data is already imported into an existing Render Postgres, stick to Option A for simplicity.

--------------------------------------------------------------------------------

## 3) Render — Create/Configure the Backend Web Service

A) Using Blueprint (render.yaml)
1) Login to Render
2) New + -> Blueprint
3) Connect your GitHub repo and select this repository
4) Render will detect render.yaml. If you do NOT want a new database, remove the “databases” resource before confirming or delete it after provisioning.
5) Confirm the Web Service “trikonekt-backend”:
   - Root Directory: backend
   - Build Command: pip install -r requirements.txt && python manage.py collectstatic --noinput
   - Start Command: gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
   - Post-deploy Command: python manage.py migrate
6) Environment Variables (set/confirm after provisioning):
   - DJANGO_SETTINGS_MODULE=core.settings
   - DEBUG=False
   - SECRET_KEY=(keep Render auto-generated or set your own)
   - ALLOWED_HOSTS=api.trikonekt.com,.onrender.com
   - CSRF_TRUSTED_ORIGINS=https://trikonekt.com,https://api.trikonekt.com
   - CORS_ALLOWED_ORIGINS=https://trikonekt.com
   - SECURE_SSL_REDIRECT=True
   - DATABASE_URL=(Paste your External DB string if you’re using an existing DB)
   - Optional: EMAIL_HOST_USER, EMAIL_HOST_PASSWORD

B) Manual service (without Blueprint)
1) New + -> Web Service -> Build from Repo
2) Root Directory: backend
3) Runtime: Python
4) Build Command: pip install -r requirements.txt && python manage.py collectstatic --noinput
5) Start Command: gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
6) Env Vars: same as above
7) Add Post-Deploy Hook: python manage.py migrate

C) Test deployment
- Wait for the deploy to finish successfully
- Use the “Open” button to check the default onrender.com URL
- Health checks and logs:
  - Logs tab: verify Gunicorn starts without errors
  - If something fails, re-check env values and build command

D) Create a superuser (if needed)
- Render -> Web Service -> Shell
- Run: python manage.py createsuperuser

--------------------------------------------------------------------------------

## 4) Render — Add Custom Domain api.trikonekt.com

1) Service -> Settings -> Custom Domains -> Add Domain: api.trikonekt.com
2) Render shows a CNAME target like your-service.onrender.com
3) Go to Namecheap and add:
   - Type: CNAME
   - Host: api
   - Value: your-service.onrender.com
   - TTL: Automatic
4) Wait for Render to verify and auto-provision SSL
5) Keep SECURE_SSL_REDIRECT=True to force HTTPS

More DNS details: see docs/NAMECHEAP_DNS.md

--------------------------------------------------------------------------------

## 5) Vercel — Deploy the Frontend (React) at trikonekt.com

1) Login to Vercel
2) New Project -> Import GitHub repo
3) Setup:
   - Framework Preset: Create React App (auto)
   - Root Directory: frontend
   - Build Command: npm run build
   - Output Directory: build
   - Environment Variables (Production):
     - REACT_APP_API_URL=https://api.trikonekt.com/api
4) Deploy (first deploy will use vercel.json and your env var)

Add Custom Domain(s) on Vercel:
- Project -> Settings -> Domains:
  - Add trikonekt.com
  - Optional: add www.trikonekt.com and set redirect www -> apex

Namecheap DNS for Vercel:
- Apex/root (trikonekt.com) cannot be CNAME at Namecheap. Use:
  - A Record:
    - Host: @
    - Value: 76.76.21.21
- www:
  - CNAME Record:
    - Host: www
    - Value: cname.vercel-dns.com

More DNS details: see docs/NAMECHEAP_DNS.md

After DNS resolves and SSL is active, Redeploy on Vercel to bake REACT_APP_API_URL into the production bundle (if changed).

--------------------------------------------------------------------------------

## 6) Namecheap — Full DNS Summary

In Namecheap -> Domain List -> trikonekt.com -> Manage -> Advanced DNS:
- A @ -> 76.76.21.21 (Vercel apex)
- CNAME www -> cname.vercel-dns.com (Vercel)
- CNAME api -> your-service.onrender.com (Render)

Remove parked/redirect/duplicate records. Save changes. Propagation can take minutes to hours.

Verify with:
```
nslookup trikonekt.com
nslookup www.trikonekt.com
nslookup api.trikonekt.com
```

--------------------------------------------------------------------------------

## 7) End-to-End Verification

- Frontend: https://trikonekt.com
  - App loads; navigation works (SPA)
- Backend admin: https://api.trikonekt.com/admin
  - Admin login (superuser)
- API calls:
  - The frontend should call https://api.trikonekt.com/api (enabled by REACT_APP_API_URL)
  - JWT flows work: login -> token -> refresh

If CORS/CSRF issues occur:
- Render env must have:
  - ALLOWED_HOSTS=api.trikonekt.com,.onrender.com
  - CSRF_TRUSTED_ORIGINS=https://trikonekt.com,https://api.trikonekt.com
  - CORS_ALLOWED_ORIGINS=https://trikonekt.com

--------------------------------------------------------------------------------

## 8) Ongoing Updates (CI/CD Behavior)

- Render (backend):
  - If you used Blueprint with autoDeploy: pushing to main triggers a new deploy
  - Post-deploy migration runs automatically (per render.yaml)
  - Check logs after deploy

- Vercel (frontend):
  - Push to main triggers a new production build/deploy
  - If you change the API domain or path, update the env var and redeploy
  - Preview deploys (on pull requests) will use a *.vercel.app domain (not added to CSRF/CORS by default). You can add the preview domain if you want to test previews calling prod API.

--------------------------------------------------------------------------------

## 9) Media Storage (Important)

Render free disk is ephemeral:
- Any uploaded media will disappear on redeploy/idle
- For persistence, switch to Cloud storage (Cloudinary/S3) later:
  - Cloudinary (quick start):
    - pip install django-cloudinary-storage cloudinary
    - Add INSTALLED_APPS: cloudinary, cloudinary_storage
    - Set DEFAULT_FILE_STORAGE='cloudinary_storage.storage.MediaCloudinaryStorage'
    - Env: CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>
  - Update settings and test uploads

--------------------------------------------------------------------------------

## 10) Troubleshooting

- ModuleNotFoundError: dj_database_url
  - Ensure `.venv\Scripts\pip install -r backend\requirements.txt` ran; re-run if needed
- “Disallowed host” on Render:
  - Add `api.trikonekt.com` to ALLOWED_HOSTS
- CORS/CSRF blocked:
  - Ensure CSRF_TRUSTED_ORIGINS includes https://trikonekt.com and https://api.trikonekt.com
  - Ensure CORS_ALLOWED_ORIGINS includes https://trikonekt.com (your frontend)
- 404 on api.trikonekt.com:
  - Confirm Render service is healthy and custom domain is verified
- Cold starts / latency (free tier):
  - Render free services sleep; first request can be slow after idle
- Database connection:
  - Use the External connection string for local imports
  - In Render Web Service, ensure DATABASE_URL is set and correct

--------------------------------------------------------------------------------

## 11) Quick Command Reference (Windows)

Local venv and deps:
```
py -3 -m venv .venv
.venv\Scripts\activate
pip install -r backend\requirements.txt
```

Switch to Postgres locally (new terminal):
```
set DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
.venv\Scripts\python backend\manage.py migrate
.venv\Scripts\python backend\manage.py loaddata sqlite_data.json
.venv\Scripts\python backend\manage.py reset_sequences
```

Runserver locally (pointing to whichever DB DATABASE_URL is set to):
```
.venv\Scripts\python backend\manage.py runserver
```

--------------------------------------------------------------------------------

## 12) Final Checklist

- [ ] Backend deploy green on Render; logs clean
- [ ] API domain on Namecheap (api.trikonekt.com -> CNAME to onrender.com)
- [ ] Frontend deploy green on Vercel
- [ ] Vercel domain on Namecheap (A @ to 76.76.21.21; CNAME www to cname.vercel-dns.com)
- [ ] HTTPS works on both domains
- [ ] JWT login flows succeed from the frontend
- [ ] If persistent user uploads required: plan Cloudinary/S3

This completes the full deployment process for Render + Vercel with Namecheap DNS using trikonekt.com and api.trikonekt.com.

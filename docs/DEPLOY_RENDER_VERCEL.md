# Production Deploy: Render (Django + Postgres) + Vercel (React) with trikonekt.com

This repo is prepared to run Django on Render and React on Vercel using custom domains:
- Frontend: https://trikonekt.com (Vercel)
- Backend: https://api.trikonekt.com (Render Web Service)
- Database: Render PostgreSQL

Important:
- You already migrated SQLite data to Postgres using the External DATABASE_URL. If you want the Render Web Service to use the same database, attach that existing DB to the service (recommended), or set the exact DATABASE_URL on the service. Avoid creating a separate new DB unless you plan to re-import data.

Repo changes already present:
- render.yaml (blueprint) to provision a web service and (optionally) a Postgres database
- backend configured for dj-database-url, WhiteNoise, security via env
- frontend/.env.production pointing to https://api.trikonekt.com/api
- frontend/vercel.json for SPA routing

---

## 1) Push the repository to GitHub

If the repo isn’t on GitHub yet:
- Initialize and commit changes locally:
  ```
  git init
  git add .
  git commit -m "Prepare Render + Vercel deploy"
  ```
- Create a GitHub repo and add remote:
  ```
  git remote add origin https://github.com/<your-username>/<repo>.git
  git branch -M main
  git push -u origin main
  ```

---

## 2) Render: Backend (Django) setup

Option A (Recommended): Use the existing Postgres you migrated to
1) In Render, create a Web Service from this repo using "Blueprint" (render.yaml).
   - Alternatively: New -> Web Service (build from repo), set Root Directory backend and the build/start commands from render.yaml manually.
2) Database:
   - If you already have a Postgres instance on Render (the one you migrated data into), attach it:
     - In the Web Service -> Environment -> Add Environment Variable -> Key: DATABASE_URL -> Paste the External connection string you used for migration
     - Remove the `databases` block from render.yaml (or ignore it) to prevent creating a new database; OR make sure to NOT create a second DB in the Blueprint
     - If you use the Blueprint, you can delete the auto-created empty database resource after provisioning and keep the one with your data; then set DATABASE_URL manually on the service
3) Environment variables (Render Web Service):
   - DJANGO_SETTINGS_MODULE=core.settings
   - SECRET_KEY=generate-a-strong-secret (or keep auto-generated if using render.yaml)
   - DEBUG=False
   - ALLOWED_HOSTS=api.trikonekt.com,.onrender.com
   - CSRF_TRUSTED_ORIGINS=https://trikonekt.com,https://api.trikonekt.com
   - CORS_ALLOWED_ORIGINS=https://trikonekt.com
   - SECURE_SSL_REDIRECT=True
   - DATABASE_URL=<the one you used to import data>  (if not attached via fromDatabase)
   - Optional: EMAIL_HOST_USER / EMAIL_HOST_PASSWORD
4) Build & start commands (already in render.yaml):
   - Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
   - Start: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`
   - Post-deploy: `python manage.py migrate`
5) First deploy:
   - Trigger deploy. Monitor logs. Ensure health check passes.
6) Create superuser (if needed):
   - Render -> your service -> Shell
   - `python manage.py createsuperuser`

Option B: Use the database created by the Blueprint (fresh DB)
- The blueprint `databases:` section will create an empty database.
- The service will use the auto-attached DATABASE_URL (fromDatabase).
- If you want your existing SQLite data, re-run the migration/loaddata process targeting this new database:
  1) Copy External connection string of the new DB.
  2) Locally set `DATABASE_URL=<new-db>` in a terminal.
  3) Run: `python backend/manage.py migrate`, `python backend/manage.py loaddata sqlite_data.json`, `python backend/manage.py reset_sequences`.
- This duplicates effort, so Option A is simpler if you already imported.

---

## 3) Render: Custom domain api.trikonekt.com

1) In the Web Service -> Settings -> Custom Domains -> Add Domain: `api.trikonekt.com`
2) Render will provide a CNAME target (like `your-service.onrender.com`).
3) In your DNS (trikonekt.com registrar), add:
   - Type: CNAME
   - Host: `api`
   - Value: `your-service.onrender.com`
4) Wait for verification and SSL to be active (Render handles certificates automatically).
5) After SSL, keep `SECURE_SSL_REDIRECT=True` (already set in env).

---

## 4) Vercel: Frontend (React) with trikonekt.com

1) In Vercel, import the GitHub repo:
   - Project settings:
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Output: `build` (vercel.json already configures this)
2) Environment -> Production:
   - `REACT_APP_API_URL=https://api.trikonekt.com/api`
3) Custom domain:
   - Add domain: `trikonekt.com`
   - Follow DNS instructions:
     - Usually a CNAME to `cname.vercel-dns.com`
     - Or Vercel-provided A/AAAA records
4) After domain verified and SSL active, redeploy (so bundle contains correct API URL).

---

## 5) Final checks

- Visit https://trikonekt.com and test:
  - Login flow (JWT), protected routes in React
  - API calls go to https://api.trikonekt.com/api and succeed
- Visit https://api.trikonekt.com/admin to confirm Django admin works.
- Media:
  - On Render free, filesystem is ephemeral. If uploads must persist, plan to use Cloud storage (Cloudinary or S3) and set DEFAULT_FILE_STORAGE accordingly.

---

## 6) Optional: Hardening

- HSTS (already supported via env in settings.py):
  - SECURE_HSTS_SECONDS=31536000
  - SECURE_HSTS_INCLUDE_SUBDOMAINS=True
  - SECURE_HSTS_PRELOAD=True
  - Only enable after HTTPS is working correctly on api.trikonekt.com
- Logging:
  - Check service logs in Render. Gunicorn logs go to stdout/stderr.

---

## 7) Troubleshooting

- ModuleNotFoundError dj_database_url:
  - Ensure `pip install -r backend/requirements.txt` ran in your venv.
- Connection issues to Postgres:
  - Verify `DATABASE_URL` and that you’re using the External connection string.
  - On Windows, use PowerShell: `$env:DATABASE_URL="..."` within the same terminal session you run manage.py commands.
- CORS/CSRF:
  - If requests are blocked, confirm:
    - ALLOWED_HOSTS includes `api.trikonekt.com`
    - CSRF_TRUSTED_ORIGINS includes `https://trikonekt.com` and `https://api.trikonekt.com`
    - CORS_ALLOWED_ORIGINS includes `https://trikonekt.com`
- Static/Media:
  - Static is served via WhiteNoise.
  - Media is served by Django (urls.py uses `static(settings.MEDIA_URL, ...)` unconditionally). For heavy media use, move to S3/Cloudinary.

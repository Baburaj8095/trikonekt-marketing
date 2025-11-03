# Production Deployment: Render (Django API) + Vercel (React)

This repo is prepped for a split deployment:
- Backend (Django + DRF) on Render.com
- Frontend (Create React App) on Vercel

Key production changes already in repo:
- render.yaml added to provision a Python Web Service + Postgres + persistent media disk on Render
- Whitenoise enabled for static files; STATIC_ROOT configured
- CORS/CSRF configured to allow Vercel domains
- DATABASE_URL support via dj-database-url
- JWT auth remains enabled; CSRF is exempt only for /api/* via middleware

Follow these steps to deploy.

---

## 0) Prerequisites

- Push this repo to GitHub/GitLab/Bitbucket.
- Create accounts on:
  - Render: https://render.com
  - Vercel: https://vercel.com

---

## 1) Backend on Render (Django API)

This repo contains render.yaml at the repository root. Render will auto-detect it and create:

- A Web Service: `trikonekt-backend`
- A Free Postgres DB: `trikonekt-db`
- A persistent Disk mounted at `backend/media`

What Render will run (from render.yaml):
- buildCommand:
  - `pip install -r requirements.txt`
  - `python manage.py collectstatic --noinput`
- preDeployCommand:
  - `python manage.py migrate --noinput`
- startCommand:
  - `gunicorn core.wsgi:application`
- healthCheckPath:
  - `/admin/login/?next=/admin/`

Steps:
1) In Render, click New -> + Blueprint, select this repo.
2) Ensure `Root Directory` for the backend service is `backend` (render.yaml sets rootDir).
3) Confirm the Free Postgres DB is created and attached via `DATABASE_URL`.
4) Confirm a Disk is added and mounted at `/opt/render/project/src/backend/media` (already in render.yaml).
5) Review/adjust environment variables that Render will create from render.yaml:
   - SECRET_KEY: generated automatically
   - DEBUG = False
   - ALLOWED_HOSTS = .onrender.com
   - CSRF_TRUSTED_ORIGINS = https://*.vercel.app,https://*.onrender.com
   - CORS_ALLOWED_ORIGINS = https://your-frontend.vercel.app (placeholder)
   - CORS_ALLOWED_ORIGIN_REGEXES = ^https://.*\.vercel\.app$
   - SECURE_SSL_REDIRECT = True
   - HSTS variables (preload, include subdomains, seconds)
   - DATABASE_URL (auto wired from the Render DB)
   - Optional email vars:
     - EMAIL_HOST_USER
     - EMAIL_HOST_PASSWORD
     - DEFAULT_FROM_EMAIL
6) Click "Apply". Render will deploy and run migrations automatically.

Notes:
- The regex already allows all Vercel preview and production domains. You can leave CORS_ALLOWED_ORIGINS as-is or change to your exact production domain once known. Keeping the regex ensures previews work too.
- STATIC files are served by Whitenoise.
- MEDIA files persist on the attached Disk.

After deploy:
- Copy your backend URL, e.g. https://trikonekt-backend.onrender.com
- Admin URL: https://trikonekt-backend.onrender.com/admin/

Create a superuser (one-time):
- Use Render -> your service -> Shell, then run:
  - python manage.py createsuperuser
- Alternatively, add a custom management command later to auto-create from env.

Optional: seed locations data (large JSON):
- From Render Shell:
  - python manage.py load_location_data
- This loads countries, states, and cities from backend/locations/data.

---

## 2) Frontend on Vercel (React)

Vercel will auto-detect Create React App and use:
- Build Command: `npm run build`
- Output Directory: `build`
- Root Directory: `frontend`

Steps:
1) In Vercel, click "New Project" and import this repo.
2) In "Root Directory" select `frontend`.
3) Set Environment Variables (Production and Preview):
   - REACT_APP_API_URL = https://trikonekt-backend.onrender.com/api
4) Deploy.

Notes:
- The frontend axios baseURL (src/api/api.js) uses REACT_APP_API_URL in production.
- For local development, it falls back to "/api" (proxied) or http://localhost:8000/api.

---

## 3) Verify End-to-End

- API health check:
  - Open https://trikonekt-backend.onrender.com/admin/login/ and ensure it loads.
  - Test a public API endpoint, for example:
    - Countries: https://trikonekt-backend.onrender.com/api/location/countries/ (if view is public)
- Frontend:
  - Open your Vercel domain (e.g. https://your-frontend.vercel.app).
  - Interact with login flow and APIs.
- Check CORS:
  - If requests fail with CORS errors, confirm:
    - CORS_ALLOWED_ORIGIN_REGEXES includes ^https://.*\.vercel\.app$
    - CSRF_TRUSTED_ORIGINS includes your Vercel and Render domains
    - ALLOWED_HOSTS includes .onrender.com and any custom domains

---

## 4) Production Hardening

- Add your custom domain(s) in:
  - Render: set ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS to include your domain(s)
  - Vercel: set the domain and then update CORS_ALLOWED_ORIGINS on Render to your production domain
- Keep DEBUG=False
- Rotate SECRET_KEY if needed
- Configure email credentials (Gmail or provider of choice)
- Consider enabling HSTS at your custom domain’s CDN/edge too
- Back up your Postgres DB regularly (Render has snapshots on paid tiers)

---

## 5) Common Issues

- 405/403 with POST/PUT: CSRF should be bypassed for /api/* by middleware. Ensure frontend points to /api paths on the backend.
- 401 with JWT: Ensure refresh token flow works; clear local/session storage and re-login if tokens changed.
- Static 404: rerun collectstatic, ensure STATIC_URL/STATIC_ROOT are correct (already set).
- Media missing: ensure the Disk is attached and path matches `backend/media` (already configured).
- CORS errors: ensure your Vercel domain matches allowed origins; regex covers *.vercel.app.

---

## 6) Cloudinary media storage

This project is configured to use Cloudinary for MEDIA when the environment variable `CLOUDINARY_URL` is present.

What’s already in place:
- Dependencies added: `cloudinary`, `django-cloudinary-storage`
- Conditional settings in `backend/core/settings.py`:
  - When `CLOUDINARY_URL` is set:
    - `INSTALLED_APPS += ['cloudinary_storage', 'cloudinary']`
    - `DEFAULT_FILE_STORAGE = 'cloudinary_storage.storage.MediaCloudinaryStorage'`
    - `CLOUDINARY_STORAGE = {'SECURE': True}`
- Render blueprint (`render.yaml`) updated:
  - Added env var placeholder: `CLOUDINARY_URL` (set this in Render -> Environment)
  - Removed local disk mount (media now stored on Cloudinary)

How to configure on Render:
1) Create a Cloudinary account, then copy the environment URL (looks like `cloudinary://<api_key>:<api_secret>@<cloud_name>`).
2) In Render -> your backend service -> Environment, set:
   - `CLOUDINARY_URL = cloudinary://<api_key>:<api_secret>@<cloud_name>`
3) Redeploy. New uploads will go directly to Cloudinary.

Admin thumbnails:
- Admin list views render image thumbnails for relevant models (Products, Banners, Home/Dashboard cards, LuckyDraw submissions, FileUploads for image types).
- Thumbnails are displayed with small `<img>` tags pointing to Cloudinary URLs.

Notes about existing local media:
- If you previously stored media on the server disk, those files won’t automatically appear on Cloudinary.
- To migrate, write a one-off management command to re-save image/file fields so Django re-uploads them to Cloudinary, for example:

  Example pattern (pseudo-code):
  - For a model with an ImageField `image`:
    - Loop instances where `image` exists and `image.url` starts with your old host.
    - Re-assign the same file handle or call `instance.image.save(instance.image.name, instance.image.file, save=True)`.
    - This will push the file to Cloudinary and update the stored URL.

  Run once via Render Shell after you deploy.

Security/CORS:
- No extra CORS changes are required for loading image assets from Cloudinary.
- Keep existing CORS/CSRF rules for API domains.

## 7) Useful Links

- Render Blueprint docs (render.yaml): https://render.com/docs/blueprint-spec
- Django + Whitenoise: https://whitenoise.evans.io/
- Vercel CRA deployments: https://vercel.com/docs/frameworks/nextjs#using-create-react-app

This document assumes no further code changes are required beyond environment variables/domains. If you later add custom domains, update Render env vars accordingly and redeploy.

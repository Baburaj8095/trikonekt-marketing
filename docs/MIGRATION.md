# Migrate from SQLite to PostgreSQL (Render)

This guide migrates your existing local SQLite data to a PostgreSQL database (Render free tier) using Django’s fixtures. It works on Windows and macOS/Linux. It assumes the codebase has been updated to:
- Use `dj-database-url` so DATABASE_URL switches DB automatically
- Include a management command `reset_sequences` to fix PK sequences after loading data

Repo changes already added:
- backend/requirements.txt: psycopg2-binary, dj-database-url, whitenoise
- backend/core/settings.py: dj-database-url database config, STATIC_ROOT, WhiteNoise, security flags
- accounts.management.commands.reset_sequences: resets sequences after data import

Important notes:
- This process migrates database rows, NOT uploaded media files.
- Render free web disk is ephemeral. If you need persistent media, use a cloud storage (e.g., Cloudinary/S3) instead of local media.

---

## 0) Install dependencies locally

Windows (CMD or PowerShell):
```
python -m venv .venv
# CMD
.venv\Scripts\activate
# PowerShell
. .venv\Scripts\Activate.ps1

pip install -r backend\requirements.txt
```

macOS/Linux:
```
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

---

## 1) Ensure SQLite is up to date

Run all migrations against your SQLite DB first:
```
# Windows
python backend\manage.py migrate

# macOS/Linux
python backend/manage.py migrate
```

---

## 2) Dump data from SQLite to JSON

Use Django fixtures (exclude system tables to reduce noise/conflicts):
```
# Windows
python backend\manage.py dumpdata --natural-foreign --natural-primary ^
  --exclude=contenttypes --exclude=auth.permission --exclude=admin.logentry --exclude=sessions.session ^
  --output sqlite_data.json

# macOS/Linux (single line)
python backend/manage.py dumpdata --natural-foreign --natural-primary --exclude=contenttypes --exclude=auth.permission --exclude=admin.logentry --exclude=sessions.session --output sqlite_data.json
```

Do NOT commit `sqlite_data.json` to git. Keep it locally for the one-time import.

---

## 3) Create Render PostgreSQL and get DATABASE_URL

- In Render Dashboard, create a PostgreSQL (Free) service
- Copy the External Connection String (e.g. `postgres://USER:PASSWORD@HOST:5432/DBNAME`)
  - External string allows your local machine to connect to the DB over the internet

---

## 4) Point your LOCAL Django to Render Postgres

Open a NEW terminal (so env var applies), then:

Windows CMD:
```
set DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/DBNAME
```

Windows PowerShell:
```
$env:DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DBNAME"
```

macOS/Linux:
```
export DATABASE_URL="postgres://USER:PASSWORD@HOST:5432/DBNAME"
```

Keep the virtualenv activated in this terminal if you use one.

---

## 5) Create empty schema in Postgres

Run migrations against Postgres (since `DATABASE_URL` is set, Django now targets Postgres):
```
# Windows
python backend\manage.py migrate

# macOS/Linux
python backend/manage.py migrate
```

---

## 6) Load data into Postgres

Load the JSON dump created from SQLite:
```
# Windows
python backend\manage.py loaddata sqlite_data.json

# macOS/Linux
python backend/manage.py loaddata sqlite_data.json
```

If you see unique/constraint errors, the fixture may include objects that conflict in Postgres. Typical causes:
- Duplicate unique fields
- Data created during development that violates constraints
Resolve or exclude problematic apps/records and retry.

---

## 7) Reset sequences in Postgres

After `loaddata`, primary key sequences might still point to 1. Reset them:

```
# Windows
python backend\manage.py reset_sequences

# macOS/Linux
python backend/manage.py reset_sequences
```

This runs Django’s `sqlsequencereset` for all apps and executes the statements automatically.

---

## 8) Verify

Open a shell to spot-check counts:
```
# Windows
python backend\manage.py shell

# macOS/Linux
python backend/manage.py shell
```

Example:
```python
from django.contrib.auth import get_user_model
print("Users:", get_user_model().objects.count())

from market.models import Banner, PurchaseRequest  # adjust to your models
print("Banners:", Banner.objects.count())
print("PurchaseRequests:", PurchaseRequest.objects.count())
```

Optionally run dev server pointing to Postgres:
```
# Windows
python backend\manage.py runserver

# macOS/Linux
python backend/manage.py runserver
```

---

## 9) Configure Render Web Service to use the same DATABASE_URL

In your Render Web Service:
- Add env var: `DATABASE_URL` (same as above)
- Add security env vars as needed:
  - `DEBUG=False`
  - `ALLOWED_HOSTS=api.trikonekt.com,your-service.onrender.com`
  - `CSRF_TRUSTED_ORIGINS=https://trikonekt.com,https://*.vercel.app`
  - `CORS_ALLOWED_ORIGINS=https://trikonekt.com,https://*.vercel.app`
  - `SECURE_SSL_REDIRECT=True` (once SSL works)
- Ensure post-deploy hook runs `python manage.py migrate`
- Do NOT run `loaddata` on Render again if you already imported from local (to avoid duplicates)

---

## Rollback / Re-run tips

- To re-run from scratch in Postgres:
  1) Drop and recreate the Render database (or create a new one)
  2) Re-run steps 4–7

- To go back to SQLite locally:
  - Unset `DATABASE_URL` in your terminal, or start a fresh terminal
  - Django will use SQLite fallback again (per settings)

---

## Troubleshooting

- `psycopg2-binary` install issues on Windows:
  - If build tools are missing, install `psycopg2-binary` prebuilt wheels (already in requirements)
- `loaddata` foreign key errors:
  - Ensure all apps/migrations ran successfully
  - Load data once; if partial failures, you may need to split fixtures per app
- Sequence mismatch after import:
  - Always run `reset_sequences` after `loaddata`

---

## What changed in settings

- `DATABASES` now uses:
```python
import dj_database_url
DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        ssl_require=False
    )
}
```

- Set `DATABASE_URL` to target Postgres; omit it to fall back to SQLite.

---

## Next: Deploy frontend (Vercel) and backend (Render)

- Vercel:
  - Root: `frontend`
  - Build: `npm run build`
  - Output: `build`
  - Env: `REACT_APP_API_URL=https://api.trikonekt.com/api`
  - Custom domain: `trikonekt.com`

- Render (backend):
  - Root: `backend`
  - Build: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
  - Start: `gunicorn core.wsgi:application --bind 0.0.0.0:$PORT`
  - Post-deploy: `python manage.py migrate`
  - Custom domain: `api.trikonekt.com` (CNAME to onrender.com)

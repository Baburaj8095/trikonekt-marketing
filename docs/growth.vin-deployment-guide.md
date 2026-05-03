# growth.vin Deployment + Migration Guide (GoDaddy → Vercel + Render)

This document explains **step-by-step** how to **migrate** your existing setup from `trikonekt.com` to `growth.vin` and host:

- **Frontend (Team + Franchise login/dashboard UI)** on **Vercel**
- **Backend API (Django)** on **Render** at **`https://api.growth.vin`**
- **Admin UI screens** at **`https://admin.growth.vin/admin`** (same Vercel frontend, just a different subdomain)
- **Database** on **Render** (PostgreSQL recommended)

Domain registrar: **GoDaddy** (domain already purchased)

Existing production reference (current):

- Frontend: `www.trikonekt.com`
- API: `api.trikonekt.com`
- Admin: `trikonekt.com/admin`

---

## 0) Target URLs (what we are setting up)

| Component | Platform | URL | Notes |
|---|---|---|---|
| Frontend (public/team/franchise UI) | Vercel | `https://growth.vin` and/or `https://www.growth.vin` | Typical main website |
| Admin frontend route | Vercel | `https://admin.growth.vin/admin` | Same app, admin routes |
| Backend API | Render Web Service | `https://api.growth.vin` | Django API |
| Database | Render Postgres | (internal) | Used by backend |

> **Important**: `admin.growth.vin/admin` is a **frontend route**. The **API** should be on `api.growth.vin`.

### API URL pattern reminder (common mistake)

This backend serves API routes under the `/api/` prefix. Example:

- ✅ Login: `https://api.growth.vin/api/accounts/login/`
- ❌ Wrong: `https://api.growth.vin/accounts/login/`

---

## 1) Prerequisites

Before DNS/domain setup, make sure you have:

1. Access to **GoDaddy DNS** for `growth.vin`.
2. Access to **Vercel** (create an account + add the Git repo).
3. Access to **Render** (create an account + add the Git repo).
4. A decision on environment variables (secrets):
   - Backend: `SECRET_KEY`, database URL, allowed hosts, CORS origins, etc.
   - Frontend: API base URL (`https://api.growth.vin`) and any keys.

Also recommended before cutover:

- Lower DNS TTL to something like **600 seconds** (10 minutes) in GoDaddy for records you will change. Do this **at least a few hours before** the switch.

---

## 2) Deploy Backend to Render (api.growth.vin)

### 2.1 Create the Render Web Service

If you already have a working Render backend for `api.trikonekt.com`, you typically do **not** need a new service.
You can **reuse the same Render service** and simply add an additional custom domain: `api.growth.vin`.

1. Login to **Render** → **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Select the backend root directory (often `backend/`).

Typical Django settings on Render:

- **Runtime**: Python
- **Build Command** (example):
  ```bash
  pip install -r backend/requirements.txt
  python backend/manage.py collectstatic --noinput
  python backend/manage.py migrate
  ```
- **Start Command** (example):
  ```bash
  gunicorn core.wsgi:application
  ```

> Your project may have a different Django project module name than `core`. If so, update the gunicorn command accordingly.

### 2.2 Create/Attach Render Postgres Database

1. Render → **New +** → **PostgreSQL**.
2. Choose a name like `growth-vin-db`.
3. After creation, copy the **Internal Database URL** (or use Render’s environment variable wiring).

In the Render Web Service (backend), add environment variables:

- `DATABASE_URL` = Render Postgres URL
- `SECRET_KEY` = strong random value
- `DEBUG` = `False`
- `ALLOWED_HOSTS` should include:
  - `api.growth.vin`
  - `*.onrender.com` (optional but helpful)

### 2.3 CORS settings (critical)

Your backend must allow requests from your frontend domains.

At minimum, configure allowed origins:

- `https://growth.vin`
- `https://www.growth.vin` (if used)
- `https://admin.growth.vin`

During migration, keep the old origins too (until you fully switch traffic):

- `https://trikonekt.com`
- `https://www.trikonekt.com`
- `https://admin.trikonekt.com` (if you ever used it)

If you are using `django-cors-headers`, set (example):

```py
CORS_ALLOWED_ORIGINS = [
  "https://growth.vin",
  "https://www.growth.vin",
  "https://admin.growth.vin",
]
```

Also ensure cookies/auth headers work (if applicable):

- `CORS_ALLOW_CREDENTIALS = True` (only if you use cookies)

---

## 3) Configure Custom Domain for Backend on Render (api.growth.vin)

1. Open your Render backend service.
2. Go to **Settings** → **Custom Domains**.
3. Add: `api.growth.vin`
4. Render will show a **DNS record** to add in GoDaddy (usually a **CNAME**).

### 3.1 Add DNS record in GoDaddy for api.growth.vin

GoDaddy → Domain → **DNS** → **Add Record**:

- Type: `CNAME`
- Name/Host: `api`
- Value/Points to: (the target Render gives you)
- TTL: default

Wait for DNS propagation (5–30 minutes typical, sometimes longer).

---

## 4) Deploy Frontend to Vercel (growth.vin + admin.growth.vin)

### 4.1 Create the Vercel project

1. Login to **Vercel** → **Add New...** → **Project**.
2. Import your Git repository.
3. Set the **Root Directory** to `frontend/` (based on this repo layout).
4. Confirm framework preset (React/Vite/Next etc.).

### 4.2 Add environment variables to Vercel

Set (example):

- `VITE_API_BASE_URL` = `https://api.growth.vin`

> Use whatever env naming your frontend actually reads (e.g. `REACT_APP_...` or `VITE_...`).

### 4.2.1 Important (this repo): Vercel route proxy to API domain

This repo uses `frontend/vercel.json` to proxy frontend requests like:

- `/api/*` → backend API
- `/media/*` → backend media
- `/uploads/*` → backend uploads

So for the new domain, ensure these targets point to:

- `https://api.growth.vin`

(Previously this was pointing to `https://api.trikonekt.com`.)

### 4.3 Add Custom Domains in Vercel

In Vercel Project → **Settings** → **Domains**:

Add these domains:

1. `growth.vin`
2. `www.growth.vin` (optional but recommended)
3. `admin.growth.vin`

Vercel will show you which DNS records to add in GoDaddy.

Typical Vercel DNS patterns:

- For apex domain (`growth.vin`):
  - **A record** pointing to Vercel IP (Vercel will display the exact value)
- For subdomains like `www` and `admin`:
  - **CNAME** pointing to `cname.vercel-dns.com` (Vercel will display)

### 4.4 Add DNS records in GoDaddy for Vercel

GoDaddy → DNS:

- Ensure **no conflicting A/CNAME** records exist for the same host.
- Add/Update exactly what Vercel asks.

Wait for Vercel to verify (it will show “Valid Configuration” once correct).

---

## 5) Make `/admin` work on admin.growth.vin/admin (frontend routing)

### 5.1 What you want

- Visiting `https://admin.growth.vin/` should either:
  - redirect to `/admin`, OR
  - show an admin landing page that routes into `/admin`.

### 5.2 SPA routing rewrite (Vercel)

If your frontend is a **Single Page App** (React Router), ensure Vercel rewrites all paths to `index.html`.

This repo already contains `frontend/vercel.json`. Confirm it includes a rewrite like:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

If you use Next.js, you do not need this rewrite.

### 5.4 How admin.growth.vin/admin works (same Vercel project)

Because `admin.growth.vin` points to the **same Vercel project**, the app build is identical. The only difference is the **hostname**.

What you must ensure:

1. In Vercel → Project → Domains, add `admin.growth.vin`
2. In GoDaddy DNS, add the `admin` record that Vercel instructs (usually CNAME)
3. Keep SPA rewrite (`/(.*) → /index.html`) so refreshing `/admin` does not 404

Then your React Router route `/admin` will load normally on `admin.growth.vin/admin`.

### 5.3 Optional: redirect admin root to /admin

In Vercel, you can add a redirect so `admin.growth.vin/` goes to `/admin`.

Options:

- Add a redirect in `vercel.json`, OR
- Add it in Vercel Project settings (Redirects), OR
- In your frontend router, handle `/` differently depending on hostname.

### 5.5 Optional: force all `/admin` traffic to the admin subdomain

If someone opens:

- `https://growth.vin/admin` or `https://www.growth.vin/admin`

…you may want to redirect them to:

- `https://admin.growth.vin/admin`

This can be done in `frontend/vercel.json` using **host-based redirects**.

---

## 6) SSL/TLS certificates

- **Vercel** automatically issues SSL for `growth.vin` and `admin.growth.vin` once DNS is correct.
- **Render** automatically issues SSL for `api.growth.vin` once DNS is correct.

Do not try to manually upload certificates in GoDaddy for these platforms.

---

## 7) Final verification checklist (copy/paste)

### 7.1 DNS verification

- [ ] `growth.vin` resolves to Vercel
- [ ] `admin.growth.vin` resolves to Vercel
- [ ] `api.growth.vin` resolves to Render

### 7.2 Browser verification

- [ ] Open `https://growth.vin` and verify the frontend loads
- [ ] Open `https://admin.growth.vin/admin` and verify admin screens load

### 7.3 API verification

From a terminal:

```bash
curl -i https://api.growth.vin/healthz
```

Also test a known public endpoint:

```bash
curl -i https://api.growth.vin/api/company/
```

> Note: `https://api.growth.vin/` may return **404 Not Found** and that can be normal, because this backend defines routes like `/healthz` and `/api/...`.

### 7.4 CORS verification

- [ ] From `growth.vin`, login / dashboard API calls succeed
- [ ] From `admin.growth.vin`, admin API calls succeed
- [ ] No CORS errors in browser console

---

## 8) Common issues & fixes

### Issue: "CORS policy" blocked errors

Fix: add the exact origin (including `https://`) to backend CORS allowlist and redeploy backend.

### Issue: Admin page refresh gives 404

Fix: add SPA rewrite (Vercel rewrite to `index.html`) so deep links work.

### Issue: Vercel says domain misconfigured

Fix: remove conflicting DNS records in GoDaddy and keep only what Vercel specifies.

### Issue: API works on onrender.com but not on api.growth.vin

Fix: ensure Render custom domain is added and DNS CNAME is correct; verify `ALLOWED_HOSTS` includes `api.growth.vin`.

---

## 9) Recommended production hardening

- Use **Render Postgres** (not SQLite) for production.
- Enable database backups.
- Set `DEBUG=False`.
- Ensure `SECRET_KEY` is rotated and stored only in Render env vars.
- Set correct cookie security flags if using session auth.

---

## 9.1 Database migration (Do you need to move data?)

**If you are only migrating domains (trikonekt.com → growth.vin):**

- Recommended: **reuse the same Render backend service + same Render Postgres database**.
- In this case there is **no database migration** required.
- You only add new custom domains and update `ALLOWED_HOSTS` / CORS.

**Only migrate the database if you are creating a brand-new database** for `growth.vin`.
If you do, the high-level steps are:

1. Export from old DB (backup / dump)
2. Restore into new DB
3. Point backend `DATABASE_URL` to new DB
4. Run Django migrations

If you want, I can add exact `pg_dump` / `psql` commands once you confirm:
- old DB provider + access method, and
- new DB provider (Render Postgres is easiest).

---

## 10) Migration / Cutover Plan (recommended order)

Use this sequence to minimize downtime:

### Step A — Add new domains on platforms (no DNS yet)

1. **Render (backend)**: Add `api.growth.vin` as a custom domain to the *existing* backend service.
2. **Vercel (frontend)**: Add these as domains to the *existing* frontend project:
   - `growth.vin`
   - `www.growth.vin` (optional)
   - `admin.growth.vin`

### Step B — Update backend config for both domains

1. Add `api.growth.vin` to `ALLOWED_HOSTS`.
2. Add `https://growth.vin` / `https://admin.growth.vin` to CORS allowed origins.
3. Deploy backend.

### Step C — Add DNS records in GoDaddy

1. Add DNS for `api.growth.vin` exactly as Render instructs.
2. Add DNS for `growth.vin`, `www.growth.vin`, `admin.growth.vin` exactly as Vercel instructs.

### Step D — Validate before announcing

1. Verify `https://api.growth.vin` responds.
2. Verify `https://growth.vin` loads UI and can login.
3. Verify `https://admin.growth.vin/admin` loads admin and can call APIs.

### Step E — Optional redirect from old domain to new domain

After you confirm everything works on `growth.vin`, you can add redirects so traffic to `trikonekt.com` goes to `growth.vin`.
Where to implement redirects:

- In Vercel (recommended) using Redirect rules, OR
- In your frontend router for SPA-level redirects.

Keep the old domains active for at least **1–2 weeks** to avoid breaking existing users/bookmarks.

---

## 11) What I need from you (to tailor this exactly)

Reply with:

1. Is your React app built with **Vite** or **CRA**? (env var prefix differs)
2. What is your backend health endpoint (e.g. `/health/`), if any?
3. Do you want both `growth.vin` and `www.growth.vin`, or only one of them?
4. Are you using cookie-based auth or token/JWT auth? (affects CORS + cookies)

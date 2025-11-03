# Configure Namecheap DNS for Vercel (trikonekt.com) and Render (api.trikonekt.com)

This guide shows exactly how to wire your Namecheap DNS to:
- Vercel for the React frontend at https://trikonekt.com
- Render for the Django backend at https://api.trikonekt.com

Prerequisites
- Vercel project deployed (Root Directory: `frontend`). In Project Settings -> Domains, add `trikonekt.com` (and optionally `www.trikonekt.com`).
- Render Web Service running (from this repo, Root Directory: `backend`). In your Render Web Service, copy your service domain e.g. `your-service.onrender.com`.
- Ensure your backend ALLOWED_HOSTS, CSRF_TRUSTED_ORIGINS, and CORS_ALLOWED_ORIGINS include:
  - `api.trikonekt.com` (backend)
  - `https://trikonekt.com` (frontend)

Where to edit DNS in Namecheap
1) Log in to Namecheap
2) Left menu -> Domain List -> Find `trikonekt.com` -> Manage
3) Go to the "Advanced DNS" tab
4) Make the following records; remove any conflicting/old ones (e.g., Parking, URL Redirect, duplicate A/CNAME)

A. Point trikonekt.com (apex/root) to Vercel
- Type: A Record
- Host: @
- Value: 76.76.21.21  (Vercel edge network)
- TTL: Automatic

Note: Apex/root cannot be a CNAME on Namecheap. Vercel officially supports using the A record above.

B. Point www.trikonekt.com to Vercel
- Type: CNAME Record
- Host: www
- Value: cname.vercel-dns.com
- TTL: Automatic

Optional: In Vercel Project -> Domains, add both `trikonekt.com` and `www.trikonekt.com`. Configure www to redirect to the apex (preferred) or keep both active.

C. Point api.trikonekt.com to Render
- Type: CNAME Record
- Host: api
- Value: your-service.onrender.com  (replace with your actual Render service host)
- TTL: Automatic

Do NOT create A records for `api`; use CNAME only.

Cleanup tips (important)
- Delete any old "URL Redirect Record" for @ or www that would override A/CNAME.
- Delete any extra A/CNAME records for the same host (e.g., two A records for @), unless intentionally load balancing.
- Keep only one record per host (except when intentionally adding AAAA, which isn’t needed here).

Propagation and SSL
- DNS changes can take from a few minutes to 1-2 hours to propagate (rarely up to 24 hours).
- Vercel automatically provisions SSL for `trikonekt.com` and `www.trikonekt.com` once DNS is correct.
- Render automatically provisions SSL for `api.trikonekt.com` once the CNAME resolves.

Verification (Windows/macOS/Linux)
Use nslookup to verify:
```
nslookup trikonekt.com
nslookup www.trikonekt.com
nslookup api.trikonekt.com
```
Expected results:
- `trikonekt.com` -> 76.76.21.21
- `www.trikonekt.com` -> cname.vercel-dns.com (then resolves to Vercel)
- `api.trikonekt.com` -> CNAME your-service.onrender.com (then resolves to Render)

App checks
- Visit https://trikonekt.com (React app loads)
- Visit https://api.trikonekt.com/admin (Django admin)
- App API calls should hit https://api.trikonekt.com/api

After DNS is live (security)
- Ensure Render env has `SECURE_SSL_REDIRECT=True` so HTTP redirects to HTTPS.
- Optional HSTS (only after HTTPS works correctly):
  - `SECURE_HSTS_SECONDS=31536000`
  - `SECURE_HSTS_INCLUDE_SUBDOMAINS=True`
  - `SECURE_HSTS_PRELOAD=True`

Troubleshooting
- If `trikonekt.com` still shows Namecheap parking, delete the Parking record and keep only:
  - A @ -> 76.76.21.21
  - CNAME www -> cname.vercel-dns.com
- If `api.trikonekt.com` shows a 404 from Render, ensure the Render service is deployed/healthy and `ALLOWED_HOSTS` includes `api.trikonekt.com`.
- If frontend cannot call backend due to CORS/CSRF, verify Django env:
  - `ALLOWED_HOSTS=api.trikonekt.com,.onrender.com`
  - `CSRF_TRUSTED_ORIGINS=https://trikonekt.com,https://api.trikonekt.com`
  - `CORS_ALLOWED_ORIGINS=https://trikonekt.com`

TRIKONEKT-MARKETING (React + Django) - Production Notes + Hubble Rewards Integration
=======================================================================

This repository contains:

  - frontend/: React web app (Create React App)
  - backend/: Django REST API + background job worker

It also includes a Hubble Gift Cards integration implemented via an iframe + webhooks.


------------------------------------------------------------
1) High-level architecture
------------------------------------------------------------

Frontend (React)
  - Renders a consumer-facing Gift Cards page.
  - Fetches an iframe URL from the backend.
  - Embeds a Hubble-hosted rewards experience inside an <iframe>.

Backend (Django)
  - Generates short-lived Hubble SSO JWTs (RS256) server-side.
  - Builds the iframe URL for the Hubble Web SDK.
  - Receives Hubble webhooks, verifies HMAC signature (X-Verify), stores events,
    and processes them asynchronously.
  - Projects webhook events into a canonical internal table (HubbleTransaction)
    so the frontend can show real order status.


------------------------------------------------------------
2) Quick start (local dev)
------------------------------------------------------------

Backend (Windows PowerShell / cmd)
  cd backend
  python -m venv .venv
  .venv\Scripts\activate
  pip install -r requirements.txt
  py manage.py migrate
  py manage.py runserver

Background worker (required for webhook processing)
  cd backend
  .venv\Scripts\activate
  py manage.py process_tasks

Frontend
  cd frontend
  npm install
  npm start

Local Hubble testing quick checklist
  1) Ensure backend/.env has HUBBLE_CLIENT_ID, HUBBLE_WEBHOOK_SECRET, and HUBBLE_JWT_PRIVATE_KEY_PATH.
  2) Ensure the key exists:
       backend/keys/hubble_dev_private.pem
  3) Start API:
       cd backend
       .venv\Scripts\activate
       py manage.py runserver
  4) Start worker:
       py manage.py process_tasks
  5) Visit the Gift Cards page in the frontend:
       /user/gift-cards


------------------------------------------------------------
3) Hubble Gift Cards integration (what exists in this repo)
------------------------------------------------------------

Backend endpoints

  1) Iframe URL (consumer authenticated)
     GET /api/business/hubble/iframe-url/
     Response (production):
        { "iframeUrl": "https://...", "expiresIn": 60 }
     NOTE: In DEBUG mode only, you may pass ?debug=1 to also return the raw token.

  2) Webhook receiver (public)
     POST /api/business/hubble/webhook/
     POST /api/business/hubble/webhook/brand-updated/
     POST /api/business/hubble/webhook/partner-discount/
     POST /api/business/hubble/webhook/transaction-status/
     Requirements:
       - Must include X-Verify header
       - Uses raw request.body for signature validation

  3) Transaction status API for the logged-in user
     GET /api/business/hubble/transactions/me/?status=&limit=

Frontend route
  Consumer page:
    frontend/src/pages/HubbleGiftCards.jsx
  URL (in app routing):
    /user/gift-cards


------------------------------------------------------------
4) Hubble environment variables (backend)
------------------------------------------------------------

Configure these in backend/.env (local) or Render env vars (prod):

  # Hubble SDK base
  HUBBLE_SDK_BASE_URL=https://sdk.myhubble.money/experience-center

  # Hubble partner client id
  HUBBLE_CLIENT_ID=...

  # RSA private key for RS256 SSO token signing (pick ONE)
  HUBBLE_JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  # OR
  HUBBLE_JWT_PRIVATE_KEY_PATH=C:\path\to\private_key.pem

  # Webhook signature secret
  HUBBLE_WEBHOOK_SECRET=...

  # Optional: theme
  HUBBLE_SDK_THEME=light

  # If Hubble explicitly requires passing clientSecret in browser iframe URL:
  # WARNING: This exposes the secret in the browser query string.
  HUBBLE_CLIENT_SECRET=...
  HUBBLE_SEND_CLIENT_SECRET_TO_BROWSER=false

  # Optional webhook source IP allowlist (comma-separated). Empty disables checks.
  HUBBLE_WEBHOOK_IP_ALLOWLIST=35.200.156.199,34.47.147.244,34.14.138.52

  # Optional webhook throttle (DRF scope rate)
  DRF_THROTTLE_HUBBLE_WEBHOOK=600/min


------------------------------------------------------------
5) Security hardening implemented (repository-specific)
------------------------------------------------------------

Iframe embed hardening (frontend/src/pages/HubbleGiftCards.jsx)
  - referrerPolicy="no-referrer" to reduce token leakage via Referrer headers
  - sandbox attribute enabled (allow-scripts/forms/popups only)
  - allow list reduced to only "payment" (no clipboard permissions)
  - timeout + retry UI for iframe URL fetch

Do NOT expose partner secrets to the browser by default
  - backend/core/hubble.py only includes clientSecret in iframe URL when
    HUBBLE_SEND_CLIENT_SECRET_TO_BROWSER is enabled.

Do NOT return raw SSO token to the frontend by default
  - backend/business/views.py HubbleIframeUrlView only returns token when DEBUG and ?debug=1

Webhook verification
  - backend/core/hubble.py verify_hubble_webhook()
  - Verifies X-Verify = base64(HMAC_SHA256(raw_body, HUBBLE_WEBHOOK_SECRET))

Webhook ingress control (optional)
  - backend/business/views.py HubbleWebhookReceiverView:
      * optional IP allowlist via HUBBLE_WEBHOOK_IP_ALLOWLIST
      * dedicated webhook throttle (scope=hubble_webhook)


------------------------------------------------------------
6) Operational runbook (what happens when things fail)
------------------------------------------------------------

If iframe loads but webhook never arrives:
  - You will NOT have a canonical status update in HubbleTransaction.
  - The UX should treat iframe completion as "pending" until webhook confirmation.
  - Investigate webhook endpoint reachability, signature secret mismatch,
    IP allowlist misconfiguration, or throttling.

If webhook arrives but DB write fails:
  - The receiver attempts to store HubbleWebhookEvent; if that fails it returns 400.
  - Hubble will likely retry.
  - Check DB health and error logs.

If webhook processing fails after storage:
  - The webhook receiver still returns 200 and enqueues a BackgroundTask.
  - The worker must be running (process_tasks) to project events into HubbleTransaction.


------------------------------------------------------------
7) Important caveats / remaining production gaps
------------------------------------------------------------

Auth tokens in the frontend:
  - Current client behavior uses localStorage/sessionStorage for JWT.
  - This is NOT fintech-grade safe against XSS.
  - For high assurance, move to httpOnly secure cookies + CSRF defense.

Webhook IP allowlist:
  - Enabling HUBBLE_WEBHOOK_IP_ALLOWLIST can break webhooks if your real client IP is
    not visible to Django (proxy/load balancer config). Validate before enabling.


------------------------------------------------------------
8) Pointers to integration code (exact files)
------------------------------------------------------------

Backend:
  - backend/core/hubble.py
      generate_hubble_sso_jwt()
      build_hubble_web_sdk_url()
      verify_hubble_webhook()

  - backend/business/views.py
      HubbleIframeUrlView
      HubbleWebhookReceiverView
      HubbleTransactionsMeView

  - backend/business/urls.py
      hubble/* routes

  - backend/business/hubble_models.py
      HubbleWebhookEvent
      HubbleTransaction

  - backend/jobs/models.py
      handle_hubble_webhook_process()

Frontend:
  - frontend/src/pages/HubbleGiftCards.jsx


------------------------------------------------------------
9) More documentation
------------------------------------------------------------

See:
  docs/HUBBLE_GIFTCARDS_INTEGRATION.md

If you want a true production posture, add:
  - end-to-end audit logs for webhook processing
  - admin dashboard for webhook health/lag + replay tooling
  - cookie-based auth (httpOnly) and CSP headers

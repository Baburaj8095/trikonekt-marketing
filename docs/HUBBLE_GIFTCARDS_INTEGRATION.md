# Hubble Gift Cards Integration (Web SDK + Webhooks)

This project integrates Hubble Gift Cards using a **hybrid approach**:

1. **API call (backend)** to generate a short-lived **SSO JWT** and return the **iframe URL**.
2. **Webhook (backend)** receiver to track completed/failed/reversed transactions happening inside the iframe.

---

## Backend endpoints added

### 1) Get iframe URL (Consumer authenticated)

`GET /api/business/hubble/iframe-url/`

Returns:

```json
{
  "iframeUrl": "https://sdk.dev.myhubble.money/?clientId=...&token=...",
  "token": "<jwt>",
  "expiresIn": 60
}
```

### 2) Webhook receiver (public)

`POST /api/business/hubble/webhook/`

Requirements:
- Must include `X-Verify` header.
- Body must be raw JSON (do not modify whitespace).

Behavior:
- Verifies signature using `HUBBLE_WEBHOOK_SECRET`.
- Stores every event in `business.HubbleWebhookEvent` (idempotent).
- Enqueues background job `hubble_webhook_process`.

---

## Environment variables

Configure these in `backend/.env` (local) or Render env (prod):

```bash
# Hubble SDK
HUBBLE_SDK_BASE_URL=https://sdk.dev.myhubble.money
HUBBLE_CLIENT_ID=your_client_id

# Optional (only if Hubble requires it in iframe URL)
HUBBLE_APP_SECRET=

# JWT signing key for RS256 (pick one)
HUBBLE_JWT_PRIVATE_KEY_PEM="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
# or
HUBBLE_JWT_PRIVATE_KEY_PATH=C:\\path\\to\\private_key.pem

# Webhooks
HUBBLE_WEBHOOK_SECRET=your_webhook_secret
```

---

## Frontend route

Consumer route:

- `GET /user/gift-cards`

This page calls the backend to fetch the iframe URL and embeds it.

Menu entry added in `ConsumerShell`:
- **Gift Cards**

---

## Running locally

### Backend

```powershell
cd backend
.venv\Scripts\activate
py manage.py migrate
py manage.py runserver
```

### Background worker (for webhook processing)

```powershell
cd backend
.venv\Scripts\activate
py manage.py process_tasks
```

### Frontend

```powershell
cd frontend
npm start
```

---

## Hubble dashboard configuration checklist

1. **SSO / Web SDK**
   - Register allowed redirect/origin domains (your web domain).
   - Set your `clientId`.
   - Share your RSA public key if Hubble requires it.

2. **Webhook URL**
   - Set webhook URL to:
     - `https://<your-api-domain>/api/business/hubble/webhook/`
   - Configure webhook secret and ensure it matches `HUBBLE_WEBHOOK_SECRET`.

3. **Optional IP whitelisting**
   Hubble production IPs (from docs):
   - `35.200.156.199`
   - `34.47.147.244`
   - `34.14.138.52`

---

## Notes / Next enhancements

- The webhook task handler currently marks events as processed but does **not yet** credit Trikonekt wallet.
- If you want wallet/ledger mapping, we should confirm the business rule:
  - Should a **COMPLETED** webhook credit the user wallet? If yes, credit amount or discount amount?
  - How should **REVERSED** be handled (debit / reversal transaction)?

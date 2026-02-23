# Trikonekt — Cline Rules & Workflow

This document defines how Cline should analyze, implement, and validate changes in this repository, based on the current backend + frontend architecture.

---

## 1) System Flow Analysis (Backend ↔ Frontend)

## 1.1 High-level architecture

- **Backend**: Django + DRF + SimpleJWT (`backend/`)
  - Main URL entry: `backend/core/urls.py`
  - Core apps: `accounts`, `adminapi`, `business`, `market`, `coupons`, `uploads`, `mlm_ranks`, `notifications`, `locations`
- **Frontend**: React (CRA) + React Router + Axios (`frontend/`)
  - Main route map: `frontend/src/App.js`
  - API client: `frontend/src/api/api.js`
  - Route guards: `frontend/src/components/ProtectedRoute.jsx`, `frontend/src/components/AdminProtectedRoute.jsx`

## 1.2 Request flow

1. User opens frontend route (example: `/user/dashboard`, `/admin/dashboard`).
2. Route guard checks token namespace by path:
   - `user`, `agency`, `employee`, `business`, `admin`
3. Frontend API client (`api.js`) sends requests to `/api/*`.
   - In dev, proxy forwards `/api/*` to Django (`frontend/src/setupProxy.js`).
4. Django `core/urls.py` dispatches to app URLs:
   - `/api/accounts/*`, `/api/admin/*`, `/api/business/*`, etc.
5. DRF view executes business logic + DB operations.
6. JSON response returns to frontend; UI updates.

## 1.3 Auth/session flow

- Login endpoint: `POST /api/accounts/login/`
- Refresh endpoint: `POST /api/accounts/token/refresh/`
- JWT claims include role metadata (`role`, `category`, `is_staff`, `is_superuser`) from `accounts/token_serializers.py`.
- Frontend stores **namespaced tokens**:
  - `token_user`, `token_agency`, `token_employee`, `token_business`, `token_admin`
- Axios interceptor handles:
  - auto token attach,
  - pre-expiry refresh,
  - retry on `token_not_valid`,
  - request dedupe/caching for heavy admin routes.

## 1.4 Frontend functional flow

- Massive role-based route matrix in `App.js`:
  - Public routes (`/`, `/about`, `/v2/*`)
  - User routes (`/user/*`)
  - Agency routes (`/agency/*`)
  - Employee routes (`/employee/*`)
  - Business routes (`/business/*`)
  - Admin routes (`/admin/*`, plus legacy `/admin_user`, `/role`, `/permission`)
- `Login.jsx` handles multi-role login/registration orchestration.
- `AdminLogin.jsx` enforces staff/superuser verification.

## 1.5 Backend domain map

- **Accounts**: registration, login, profile, hierarchy, wallet, KYC, withdrawals, support
- **Admin API**: metrics, user tree, RBAC, KYC/withdraw approvals, commission configs
- **Business**: promo packages, agency package payment requests, TRI apps, rewards
- **Coupons**: coupon masters, assignments, e-coupon store, orders
- **Market**: products, purchase requests, merchant shops/products
- **Uploads**: dashboard/home media, lucky draw submission pipeline
- **MLM ranks**: rank upgrades, eligibility, commission holds
- **Notifications**: inbox, unread count, mark-read, admin dispatch

---

## 2) Cline Rules for This Repo

## 2.1 Safety + architecture rules

1. **Do not break namespaced auth storage** (`token_<namespace>`). Any auth change must preserve namespace isolation.
2. **Do not introduce direct absolute API URLs in components**. Use `frontend/src/api/api.js` helpers only.
3. **Respect existing route families** (`/user`, `/agency`, `/employee`, `/business`, `/admin`).
4. **Preserve backward-compatible aliases** already present in backend URLs (e.g., `/api/adminapi/`).
5. **Keep role checks explicit** in both frontend guards and backend permissions.

## 2.2 Backend change rules

1. When adding endpoint:
   - Add view + serializer + url,
   - wire under correct app in `core/urls.py` include chain,
   - ensure permissions/auth are explicit.
2. Prefer DRF generic/APIView style consistent with existing app.
3. Any new response consumed by UI should be stable and backward-compatible.
4. For heavy list endpoints, prefer pagination/filtering conventions already used in project.
5. If endpoint affects admin UI, verify `adminapi/urls.py` path naming consistency.

## 2.3 Frontend change rules

1. Add API wrappers in `frontend/src/api/api.js` before using from pages.
2. Avoid duplicate direct `API.get/post` usage spread across many components for same feature.
3. Route-level protections must use `ProtectedRoute` / `AdminProtectedRoute`.
4. Keep redirects role-aware (role_effective + namespace rules).
5. For expensive calls in admin dashboards, use existing `cacheTTL`/`dedupe` patterns.

## 2.4 Quality and testing rules

1. For backend changes, run:
   - `python manage.py check`
   - relevant endpoint smoke checks.
2. For frontend changes, run:
   - `npm run build` (or at minimum `npm start` smoke in dev)
3. Validate at least one flow end-to-end (login → protected page → API data render).
4. Never commit secrets/hardcoded credentials.

## 2.5 Code style rules for Cline outputs

1. Keep patches minimal and scoped.
2. Reuse existing naming patterns and file organization.
3. Prefer additive changes over disruptive refactors unless requested.
4. Include short implementation notes in PR/summary:
   - what changed,
   - why,
   - what was validated.

---

## 3) Recommended Cline Workflow (Trikonekt)

## Phase A — Discover

1. Read the entry points first:
   - `backend/core/urls.py`
   - `frontend/src/App.js`
   - `frontend/src/api/api.js`
2. Identify which app owns the feature (`accounts`, `business`, `market`, etc.).
3. Trace current UI route → API call → backend endpoint before editing.

## Phase B — Plan

1. Define required changes in 3 layers:
   - API contract
   - Backend logic/data
   - Frontend UI/route integration
2. List impact radius:
   - role(s) impacted,
   - admin involvement,
   - wallet/commission/kyc side effects if any.

## Phase C — Implement

1. Backend first (models/serializers/views/urls).
2. Add/extend frontend API wrapper in `api.js`.
3. Wire UI page/component + route guard behavior.
4. Keep compatibility with existing aliases and payload structures.

## Phase D — Validate

1. Authentication scenarios:
   - valid login,
   - token refresh,
   - role route access.
2. Functional scenario:
   - trigger action from UI,
   - confirm backend state change,
   - confirm UI reflects result.
3. Regression spot-check:
   - admin routes,
   - user dashboard core APIs,
   - notifications/unread if touched.

## Phase E — Deliver

1. Provide concise change summary with files modified.
2. Provide verification steps/commands.
3. Mention any follow-up hardening items (if out-of-scope).

---

## 4) Quick Execution Checklist for Cline

- [ ] Confirm impacted role namespace(s)
- [ ] Confirm frontend route(s) and guard behavior
- [ ] Confirm API wrapper exists/updated in `api.js`
- [ ] Confirm backend endpoint wired in app `urls.py`
- [ ] Confirm serializer + permissions are explicit
- [ ] Run backend/frontend smoke checks
- [ ] Summarize with test evidence

---

## 5) Optional Next Improvement Targets

1. Split `frontend/src/App.js` into role route modules to reduce complexity.
2. Split `frontend/src/api/api.js` into domain API files (`authApi`, `adminApi`, `marketApi`, etc.).
3. Add formal API contract docs per app under `docs/`.
4. Add minimal automated API smoke tests for critical flows (login, wallet, promo purchase, admin approvals).

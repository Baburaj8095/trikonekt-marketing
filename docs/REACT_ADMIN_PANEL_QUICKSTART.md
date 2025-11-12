React Admin Panel Quickstart (Material UI + DRF)
================================================

This project already includes a dynamic React Admin that mirrors Django Admin features using DRF viewsets and Material UI. Use this guide to run it locally, understand the folder structure, wire authentication, and customize or add model-specific pages.

What you get
- Auto-discovered CRUD endpoints for every Django-admin registered model
- Server-side pagination, search and ordering
- Model-level permissions enforced via DjangoModelPermissions
- Reusable MUI components (DataGrid wrapper, generic Create/Edit dialog)
- JWT auth integrated with the existing axios client
- Dev proxy and .env samples

Folder structure (frontend)
- src/
  - admin-panel/
    - api/
      - client.js                  → axios client re-export (uses src/api/api.js)
    - components/
      - data/
        - DataTable.jsx            → MUI X DataGrid wrapper with server-side fetcher
    - dynamic/
      - ModelsIndex.jsx            → Index of all discovered admin models (by app)
      - ModelList.jsx              → Generic list + CRUD page for any model (via URL params)
      - ModelFormDialog.jsx        → Generic create/edit dialog from serializer field metadata
    - examples/                    → (Optional) Model-specific sample pages you can customize (see below)
  - components/
    - layouts/
      - AdminShell.jsx             → Admin layout, includes link to Models index
  - App.js                         → Routes include /admin/dashboard/models/... for dynamic admin

Folder structure (backend)
- backend/adminapi/
  - dynamic.py                     → Dynamic ModelViewSets built from Django admin registry
  - urls.py                        → Mounts router + admin-meta endpoint
- backend/core/settings.py         → INSTALLED_APPS includes "adminapi" (already added)

How it works
- Backend dynamic CRUD
  - Router exposes DRF ModelViewSets for each admin-registered model:
    - GET  /api/admin/dynamic/:app/:model/?page=&page_size=&search=&ordering=
    - POST /api/admin/dynamic/:app/:model/
    - GET  /api/admin/dynamic/:app/:model/:id/
    - PATCH/PUT /api/admin/dynamic/:app/:model/:id/
    - DELETE    /api/admin/dynamic/:app/:model/:id/
    - POST /api/admin/dynamic/:app/:model/bulk_action/  { "action": "bulk_delete", "ids": [1,2,3] }
- Model metadata for UI scaffolding
  - GET /api/admin/admin-meta/
  - Returns for each model:
    - app_label, model, verbose names
    - route to use for CRUD calls (e.g., "admin/dynamic/accounts/customuser/")
    - list_display, search_fields, list_filter (normalized), actions
    - serializer field metadata for building generic forms

Authentication and permissions
- JWT auth is already wired using the existing axios client at src/api/api.js.
- Obtain tokens:
  - POST /api/accounts/login/  (username, password) → access/refresh tokens
  - POST /api/accounts/token/refresh/ → refresh token
- Permissions enforced in API using DjangoModelPermissions:
  - GET list/retrieve ⇒ requires view_{model}
  - POST ⇒ add_{model}
  - PUT/PATCH ⇒ change_{model}
  - DELETE ⇒ delete_{model}
- To see rows and perform actions in the React admin, staff users need the corresponding permissions.

Run locally
1) Backend
   - Ensure app is configured (done in this repo):
     - INSTALLED_APPS includes "adminapi"
     - core/urls.py includes path("api/admin/", include("adminapi.urls"))
   - Start server:
     - python backend/manage.py runserver 0.0.0.0:8000

2) Frontend
   - Ensure dependencies (including MUI X DataGrid) are installed:
     - cd frontend
     - npm i
   - Start dev server:
     - npm start
   - CRA dev proxy forwards /api and /media to http://localhost:8000 (see src/setupProxy.js)

3) Login & navigate
   - Visit http://localhost:3000/admin/login and authenticate as a staff user.
   - Navigate to Admin → Models to see the auto-discovered models.
   - Click a model to open the generic listing with search, sorting, pagination, bulk delete, and Create/Edit dialogs.

Environment configuration
- Frontend: frontend/.env (see .env.example)
  - REACT_APP_API_URL=http://localhost:8000/api  (optional; if omitted, axios uses "/api" and CRA proxies to Django)
- Backend: backend/.env (example)
  - CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
  - CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
  - SIMPLE_JWT_ACCESS_LIFETIME=300
  - SIMPLE_JWT_REFRESH_LIFETIME=86400

Proxy (dev)
- src/setupProxy.js proxies:
  - /api/* → http://localhost:8000
  - /media/* → http://localhost:8000
- This ensures direct navigations to /api/... in the browser do not return index.html.

Sample: Users model (accounts.CustomUser)
- Dynamic route:
  - /admin/dashboard/models/accounts/customuser
- Example API calls used by the generic page:
  - GET  /api/admin/dynamic/accounts/customuser/?page=1&page_size=25&search=&ordering=-id
  - POST /api/admin/dynamic/accounts/customuser/
  - PATCH/DELETE /api/admin/dynamic/accounts/customuser/:id/
- The generic page will:
  - Render columns from ModelAdmin.list_display (fallback to ["id", "__str__"])
  - Provide search, sort, pagination
  - Open ModelFormDialog for Create/Edit using serializer field metadata

Add model-specific pages (optional)
- You can create “thin wrapper” pages over the generic components to:
  - Pin a specific model without using URL params
  - Override columns (e.g., format role, category, state/city)
  - Add custom toolbar actions

We included two examples under src/admin-panel/examples:
- UsersPage.jsx (accounts.CustomUser)
- ProductPage.jsx (market.Product)

Add routes (optional)
- App.js already includes:
  - /admin/dashboard/models (index) and /admin/dashboard/models/:app/:model (list)
- You can also expose example routes:
  - /admin/dashboard/examples/users
  - /admin/dashboard/examples/products

Dark / Light theme (optional UI enhancement)
- Wrap your app with MUI ThemeProvider and keep a toggle in context or local storage:
  import { createTheme, ThemeProvider } from "@mui/material/styles";
  const [mode, setMode] = useState(localStorage.getItem("theme") || "light");
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);
  // Save toggle: localStorage.setItem("theme", nextMode)

Security notes
- The admin-meta endpoint lists all admin-registered models, while the API enforces permissions on every request.
- Optionally you can filter admin-meta to include only models where the user has view/add/change/delete permissions to hide inaccessible models from the UI.

Troubleshooting
- 403 Forbidden: ensure your staff user has view_{model} (and others) on the model.
- Search/Ordering not working: verify ModelAdmin.search_fields & DRF OrderingFilter compatibility.
- Frontend cannot reach APIs: confirm CRA proxy or set REACT_APP_API_URL.

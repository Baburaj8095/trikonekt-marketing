React Admin Panel for Django (Material UI + DRF)
================================================

Overview
- Fully client-side React Admin that mirrors Django Admin features:
  - Model listing with pagination, search, ordering, filtering
  - CRUD (create, edit, delete)
  - Model-level permissions (view, add, change, delete) via DjangoModelPermissions
  - JWT auth integrated with existing frontend axios client
  - Dynamic model discovery using Django Admin registry
  - Optional dashboard pages remain as-is
- Tech Stack: React (CRA), Material UI v5/7, MUI X DataGrid, React Router v6, Axios, Django REST Framework.

What was added
- Backend (DRF, auto-discovery)
  - backend/adminapi/dynamic.py: Exposes router + viewsets for each admin-registered model, and /api/admin/admin-meta/ for model metadata.
  - backend/adminapi/urls.py: Includes dynamic router and admin-meta route.
  - backend/core/settings.py: Adds 'adminapi' to INSTALLED_APPS.

- Frontend (React, MUI)
  - src/admin-panel/api/client.js: Re-exports the existing axios API instance.
  - src/admin-panel/components/data/DataTable.jsx: Reusable server-side DataGrid wrapper.
  - src/admin-panel/dynamic/ModelsIndex.jsx: Auto-discovered model index (grouped by app).
  - src/admin-panel/dynamic/ModelList.jsx: Generic list + CRUD page per model.
  - src/admin-panel/dynamic/ModelFormDialog.jsx: Generic create/edit dialog built from serializer field metadata.
  - src/App.js: Adds routes for the dynamic admin pages.
  - src/components/layouts/AdminShell.jsx: Adds a sidebar link to the dynamic Models page.
  - frontend/.env.example: Sample env file for frontend axios baseURL configuration.

Folder structure (frontend)
- src/
  - admin-panel/
    - api/
      - client.js
    - components/
      - data/
        - DataTable.jsx
    - dynamic/
      - ModelsIndex.jsx
      - ModelList.jsx
      - ModelFormDialog.jsx
  - components/
    - layouts/
      - AdminShell.jsx (updated to include "Models")
  - App.js (routes wired)

Backend endpoints
- Base mount: /api/admin/ (see backend/core/urls.py)
- Dynamic per-model CRUD:
  - GET  /api/admin/dynamic/:app/:model/?page=&page_size=&search=&ordering=
  - POST /api/admin/dynamic/:app/:model/
  - GET  /api/admin/dynamic/:app/:model/:id/
  - PATCH/PUT /api/admin/dynamic/:app/:model/:id/
  - DELETE    /api/admin/dynamic/:app/:model/:id/
  - POST /api/admin/dynamic/:app/:model/bulk_action/ with body { "action": "bulk_delete", "ids": [1,2,3] }
- Model metadata for UI scaffolding:
  - GET /api/admin/admin-meta/
  - Returns an array with:
    - app_label, model, verbose names
    - route: "admin/dynamic/{app}/{model}/" (axios baseURL + this path => /api/admin/dynamic/...)
    - list_display, search_fields, list_filter (normalized), actions, serializer field metadata
    - Note: Permissions are enforced at the API via DjangoModelPermissions

Auth and permissions
- DRF Viewsets use permissions.DjangoModelPermissions, which map:
  - GET list/retrieve => requires view_{model}
  - POST => add_{model}
  - PUT/PATCH => change_{model}
  - DELETE => delete_{model}
- Frontend already uses JWT via src/api/api.js; tokens handled with refresh logic.
- Admin meta exposes all admin-registered models; actual access is guarded by the API permissions. You can optionally add a permission filter to admin_meta to hide models with no permissions for the user (simple enhancement).

How to run locally
1) Backend
   - Ensure 'adminapi' is in INSTALLED_APPS (done).
   - Start Django:
     - python backend/manage.py runserver 0.0.0.0:8000

2) Frontend
   - Ensure MUI X DataGrid installed (done):
     - npm i @mui/x-data-grid
   - Start CRA dev server:
     - cd frontend
     - npm start
   - Proxy is already configured in src/setupProxy.js to forward /api and /media to http://localhost:8000

3) Login and navigation
   - Visit http://localhost:3000/admin/login and authenticate as a staff user with appropriate permissions.
   - Navigate to Admin -> Models to see auto-discovered models.
   - Click a model to go to the listing page with search, sort, pagination, bulk delete, and Create/Edit dialogs.

Sample code for one model: Users (accounts.CustomUser)
- Access dynamic page directly:
  - /admin/dashboard/models/accounts/customuser
- It uses:
  - DataTable.jsx for listing with server-side pagination, search, and sorting
  - ModelFormDialog.jsx for create/edit, using field metadata from admin-meta
- Example endpoints invoked:
  - GET  /api/admin/dynamic/accounts/customuser/?page=1&page_size=25&search=&ordering=-id
  - POST /api/admin/dynamic/accounts/customuser/
  - PATCH/DELETE /api/admin/dynamic/accounts/customuser/:id/

Environment variables (.env)
- Frontend (.env in frontend/):
  - REACT_APP_API_URL=http://localhost:8000/api
    - Optional for bypassing CRA proxy. By default axios uses "/api", and CRA proxies to the Django server per setupProxy.js.
- Backend (.env in backend/):
  - Ensure CORS/CSRF are set to allow localhost:3000
    - CSRF_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
    - CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
  - JWT lifetimes and email settings are already env-driven in core/settings.py

Notes and customization
- Filtering: ModelAdmin.list_filter is normalized to simple field names when possible and exposed as filterset_fields. Complex spec classes are skipped.
- Search/Ordering: Mirrors ModelAdmin.search_fields and allows ordering on any field via DRF OrderingFilter.
- UI customization: You can override columns or form rendering per model by adding thin wrappers or custom pages if needed (e.g., src/pages/admin/AdminUsers.jsx) that compose DataTable and ModelFormDialog and fetch metadata for accounts/customuser specifically.
- Role-based UI: admin-meta can be extended to include permissions flags per model to hide buttons or entire models in the sidebar.

Troubleshooting
- If listing shows 403 Forbidden, ensure your staff user has view_{model} permission for that model.
- If search or ordering do not work as expected, verify ModelAdmin.search_fields and ensure fields exist; ordering uses DRF OrderingFilter.
- If the frontend cannot reach APIs, confirm the CRA proxy (src/setupProxy.js) or set REACT_APP_API_URL in frontend/.env to point to the backend URL.

Deployment guidance (high level)
- Serve Django APIs on a domain (e.g., api.example.com) with CORS configured to allow the React app origin.
- Build the React app (npm run build) and deploy on static hosting (Vercel/Netlify) or behind Django/Whitenoise if co-hosting.
- Set REACT_APP_API_URL to your backend API base (e.g., https://api.example.com/api).

React + Django (3 roles) scaffold
-------------------------------

This archive contains a minimal scaffold for a React frontend and Django backend
implementing three roles (user, agency, employee), JWT auth with role in token,
and a file upload endpoint.

Backend (backend/):
  - Python / Django project (minimal files)
  - apps: accounts, uploads
  - requirements.txt to install dependencies

Frontend (frontend/):
  - React (create-react-app style) source files in frontend/src
  - package.json included

Quick start (backend):
  cd backend
  python -m venv venv
  source venv/bin/activate   # (or venv\Scripts\activate on Windows)
  pip install -r requirements.txt
  python manage.py makemigrations
  python manage.py migrate
  python manage.py runserver

Quick start (frontend):
  cd frontend
  npm install
  npm start

Notes:
- Replace SECRET_KEY in backend/core/settings.py for production.
- This scaffold is intentionally minimal; adjust settings, CORS, DB, and static/media storage for production.

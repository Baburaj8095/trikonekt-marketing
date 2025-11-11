Custom Django Admin Dashboard (Option B)
=======================================

This project includes a fully customized, responsive, card-based Django Admin dashboard implemented via template overrides, CSS/JS, and a pluggable templatetag. All core admin functionality (CRUD, search, filters, permissions) is preserved.

What was added
--------------
1) Template overrides (under backend/templates/admin/)
   - base_site.html: Branding, font, favicon, CSS/JS includes
   - index.html: Replaces default dashboard with card grid + widgets and retains app list
   - _cards.html: Partial to render metric cards
   - login.html: Branded login page

2) Static assets (under backend/static/admin/)
   - css/admin_custom.css: Responsive, modern styles with design tokens
   - js/admin_custom.js: Chart.js sample chart and a React widget hook

3) Templatetag for pluggable cards (under backend/core/templatetags/)
   - admin_dashboard.py: Provides {% admin_render_cards %} to render dashboard cards

4) Context processor (backend/core/context_processors.py)
   - injects ADMIN_BRAND design tokens and current_year into templates

5) Settings updates (backend/core/settings.py)
   - TEMPLATES.DIRS includes BASE_DIR / 'templates' (points to backend/templates)
   - STATICFILES_DIRS includes BASE_DIR / 'static' (points to backend/static)
   - Added django.contrib.humanize for number formatting
   - Added core to INSTALLED_APPS (so templatetags can be discovered)
   - Added core.context_processors.admin_brand to context processors


How it works
------------
- Dashboard cards are rendered by a templatetag that supports either:
  - Counting records of a model (with optional filters), or
  - Calling a dotted Python function returning an integer, or
  - A literal fallback value
- If a model is specified, each card auto-links to its Admin changelist.
- The CSS uses CSS variables (design tokens) and a dark, modern look with shadows and rounded corners.
- The JS includes Chart.js by default and provides a hook for an optional React widget.
- The admin app list is still present below the new dashboard for power users.


Quick local test
----------------
1) Run the dev server:
   cd backend && python manage.py runserver

2) Visit:
   http://127.0.0.1:8000/admin

3) Log in to see the new dashboard:
   - Responsive cards grid
   - Sample chart widget
   - Applications grid beneath


Brand customization
-------------------
You can optionally define ADMIN_BRAND in backend/core/settings.py. If omitted, sane defaults are used.

Example:
ADMIN_BRAND = {
    "name": "Your Admin",
    # Place a logo in backend/static/admin/img/ and set the relative static path:
    # "logo_static_path": "admin/img/logo.svg",
    # "favicon_static_path": "admin/img/favicon.ico",
    "primary": "#2563eb",
    "secondary": "#10b981",
    "accent": "#f59e0b",
    "danger": "#ef4444",
    "muted": "#64748b",
    "font_family": "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
}

Notes:
- If logo_static_path is set and the file exists, it will be shown in the header and login page.
- Colors and font family will flow into CSS variables used throughout the UI.


Dashboard cards configuration
-----------------------------
Define ADMIN_DASHBOARD_CARDS in backend/core/settings.py to control which cards appear.

Each card supports:
- title: string (card label)
- model: "app_label.ModelName" for counting records (optional)
- filters: dict for queryset filtering (optional)
- func: dotted path to a function returning an int (optional)
- value: literal integer fallback (optional)
- icon: key string mapped to icon CSS class (defaults use emojis)
- color: one of primary | secondary | accent | danger | muted (extend in CSS if needed)
- url: explicit link; when omitted and model is provided, the card links to the Admin changelist

Example:
ADMIN_DASHBOARD_CARDS = [
    {"title": "Users", "model": "accounts.CustomUser", "icon": "users", "color": "primary"},
    {"title": "Pending KYC", "model": "accounts.UserKYC", "filters": {"status": "pending"}, "icon": "id", "color": "accent"},
    {"title": "Wallets", "model": "business.Wallet", "icon": "wallet", "color": "secondary"},
    {"title": "Transactions", "model": "business.WalletTransaction", "icon": "receipt", "color": "primary"},
    {"title": "Banners", "model": "market.Banner", "icon": "image", "color": "accent"},
    # Callable metric example (must return int):
    # {"title": "Active Users 24h", "func": "backend.admin_metrics.active_users_24h", "icon": "stat", "color": "primary"},
]

Optional callable metrics
-------------------------
Create a function that returns an integer and point a card's "func" to it.

Example (backend/admin_metrics.py):
from django.utils import timezone
from datetime import timedelta

def sample_callable_metric():
    return 42

def active_users_24h():
    # from accounts.models import CustomUser
    # since = timezone.now() - timedelta(hours=24)
    # return CustomUser.objects.filter(last_login__gte=since).count()
    return 0


Optional React widget
---------------------
You can mount a React widget in the dashboard. In admin_custom.js, a hook looks for data-widget="react-hook".
Ship a prebuilt React bundle that exposes a global:

window.mountAdminWidget = function (el) {
  // Example:
  // const root = ReactDOM.createRoot(el);
  // root.render(React.createElement(App, {}));
};

Place the built file at:
backend/static/admin/js/widgets.react.js

Then include it in base_site.html (below the Chart.js include), e.g.:
<script src="{% static 'admin/js/widgets.react.js' %}" defer></script>

The widget will automatically mount into the widget with id="admin-react-widget".


Production notes
----------------
- For production, be sure to collect static files:
  cd backend && python manage.py collectstatic --noinput
- Whitenoise is already configured; static files will be served from STATIC_ROOT.
- Template overrides are version-sensitive: if upgrading Django, verify admin/base.html blocks and class names still match.
- Security/permissions are unchanged by theming. All existing ModelAdmin permissions apply as usual.


Troubleshooting
---------------
- If the cards display "0" unexpectedly, confirm the model names and filters are valid, and that the app is in INSTALLED_APPS.
- If the templatetag isn't found, ensure "core" is in INSTALLED_APPS and the module is backend/core/templatetags/admin_dashboard.py.
- If branding doesn't show, verify ADMIN_BRAND is a dict and that logo path is under STATICFILES_DIRS.


File map
--------
- backend/core/settings.py
  - INSTALLED_APPS includes 'core' and 'django.contrib.humanize'
  - TEMPLATES.DIRS = [BASE_DIR / 'templates']
  - STATICFILES_DIRS = [BASE_DIR / 'static']
  - context processor: 'core.context_processors.admin_brand'
- backend/core/context_processors.py
  - admin_brand context processor (merges defaults with ADMIN_BRAND)
- backend/core/templatetags/admin_dashboard.py
  - {% admin_render_cards %} templatetag
- backend/templates/admin/base_site.html
- backend/templates/admin/index.html
- backend/templates/admin/_cards.html
- backend/templates/admin/login.html
- backend/static/admin/css/admin_custom.css
- backend/static/admin/js/admin_custom.js

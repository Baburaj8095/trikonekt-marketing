from datetime import datetime
from django.conf import settings


def admin_brand(request):
    """
    Provides ADMIN_BRAND design tokens and current_year to all templates.
    You can override any of these via settings.ADMIN_BRAND.
    """
    default_brand = {
        "name": "Admin",
        "logo_static_path": None,        # e.g. "admin/img/logo.svg"
        "favicon_static_path": None,     # e.g. "admin/img/favicon.ico"
        "primary": "#2563eb",
        "secondary": "#10b981",
        "accent": "#f59e0b",
        "danger": "#ef4444",
        "muted": "#64748b",
        "font_family": "Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
    }
    brand = getattr(settings, "ADMIN_BRAND", {})
    if not isinstance(brand, dict):
        brand = {}
    merged = {**default_brand, **brand}
    return {
        "ADMIN_BRAND": merged,
        "current_year": datetime.now().year,
    }

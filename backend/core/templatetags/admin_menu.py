from django import template
from django.conf import settings
from django.urls import reverse, NoReverseMatch

register = template.Library()


def admin_changelist_url(label: str):
    """
    Given 'app_label.ModelName', return admin changelist URL if possible.
    """
    try:
        app_label, model_name = label.split(".")
        return reverse(f"admin:{app_label}_{model_name.lower()}_changelist")
    except Exception:
        return None


def resolve_url(spec):
    """
    Resolve a URL spec:
      - If spec is a dotted model path 'app.Model', return admin changelist.
      - If spec looks like '/admin/...', treat as literal path.
      - If spec is a full URL 'http...' return as-is.
    """
    if not spec:
        return None
    if "." in spec and "/" not in spec and ":" not in spec:
        # likely 'app.Model'
        return admin_changelist_url(spec) or "#"
    if spec.startswith("/"):
        return spec
    if spec.startswith("http://") or spec.startswith("https://"):
        return spec
    # Try reverse name if provided
    try:
        return reverse(spec)
    except NoReverseMatch:
        return "#"


def default_menu():
    """
    Reasonable defaults based on common models in this project.
    Items support:
      - title: str
      - icon: FontAwesome class, e.g., 'fa fa-home'
      - url: explicit URL or 'app.Model' to auto-link changelist
      - children: list of items
    """
    return [
        {"title": "Dashboard", "icon": "fa fa-home", "url": "/admin/"},
        {"title": "Users", "icon": "fa fa-users", "url": "accounts.CustomUser"},
        {"title": "KYC", "icon": "fa fa-id-card", "url": "accounts.UserKYC"},
        {
            "title": "Business",
            "icon": "fa fa-briefcase",
            "children": [
                {"title": "Wallets", "url": "business.Wallet"},
                {"title": "Transactions", "url": "business.WalletTransaction"},
            ],
        },
        {"title": "Market", "icon": "fa fa-image", "url": "market.Banner"},
        {"title": "Uploads", "icon": "fa fa-upload", "url": "uploads.Upload"},
        {"title": "Locations", "icon": "fa fa-globe", "url": "/admin/locations/"},
    ]


def normalize_items(items):
    """
    Normalize items by resolving URLs and ensuring required fields exist.
    """
    norm = []
    for it in items or []:
        item = {
            "title": it.get("title", "Untitled"),
            "icon": it.get("icon", "fa fa-circle"),
            "url": resolve_url(it.get("url")),
            "children": None,
        }
        if it.get("children"):
            item["children"] = normalize_items(it["children"])
            # A parent may not need its own URL; keep None or '#' if not provided
            if not it.get("url"):
                item["url"] = "#"
        norm.append(item)
    return norm


@register.inclusion_tag("admin/partials/sidebar.html", takes_context=True)
def admin_sidebar(context):
    """
    Renders the sidebar menu. Reads configuration from settings.ADMIN_SIDEBAR.
    If not set, falls back to a default curated menu. Supports children nesting.
    """
    cfg = getattr(settings, "ADMIN_SIDEBAR", None)
    if isinstance(cfg, dict):
        items = cfg.get("items") or []
    elif isinstance(cfg, (list, tuple)):
        items = list(cfg)
    else:
        items = default_menu()

    menu = normalize_items(items)
    request = context.get("request")
    current_path = getattr(request, "path", "")
    return {
        "menu": menu,
        "current_path": current_path,
        "ADMIN_BRAND": context.get("ADMIN_BRAND"),
    }

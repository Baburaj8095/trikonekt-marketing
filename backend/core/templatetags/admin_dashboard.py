from django import template
from django.apps import apps
from django.conf import settings
from django.urls import reverse, NoReverseMatch

register = template.Library()

DEFAULT_CARDS = [
    {"title": "Users", "model": "accounts.CustomUser", "icon": "users", "color": "primary"},
    {"title": "Pending KYC", "model": "accounts.UserKYC", "filters": {"verified": False}, "icon": "kyc", "color": "accent"},
    {"title": "Wallets", "model": "accounts.Wallet", "icon": "wallet", "color": "secondary"},
    {"title": "Transactions", "model": "accounts.WalletTransaction", "icon": "receipt", "color": "primary"},
    {"title": "Withdrawals", "model": "accounts.WithdrawalRequest", "icon": "withdrawal", "color": "secondary"},
    {"title": "Withdrawals Pending", "model": "accounts.WithdrawalRequest", "filters": {"status": "pending"}, "icon": "withdrawal", "color": "danger"},
    {"title": "E-Coupon Submissions", "model": "coupons.CouponSubmission", "icon": "coupon", "color": "accent"},
    {"title": "Lucky Draw Submissions", "model": "uploads.LuckyDrawSubmission", "icon": "ticket", "color": "secondary"},
    {"title": "Lucky Draw Pending TRE", "model": "uploads.LuckyDrawSubmission", "filters": {"status": "SUBMITTED"}, "icon": "ticket", "color": "accent"},
    {"title": "Lucky Draw Pending Agency", "model": "uploads.LuckyDrawSubmission", "filters": {"status": "TRE_APPROVED"}, "icon": "ticket", "color": "accent"},
]


def _get_brand():
    return getattr(settings, "ADMIN_BRAND", {})


def _get_cards():
    return getattr(settings, "ADMIN_DASHBOARD_CARDS", DEFAULT_CARDS)


def _resolve_model(label):
    """
    label: 'app_label.ModelName'
    """
    try:
        app_label, model_name = label.split(".")
        return apps.get_model(app_label, model_name)
    except Exception:
        return None


def _compute_value(card):
    """
    Computes the card's value.
    Priority:
      1) func: dotted callable returning an int
      2) model: count with optional filters
      3) fallback: literal value (or 0)
    """
    func_path = card.get("func")
    if func_path:
        try:
            mod_path, fn_name = func_path.rsplit(".", 1)
            mod = __import__(mod_path, fromlist=[fn_name])
            fn = getattr(mod, fn_name)
            return int(fn())
        except Exception:
            return 0

    model_label = card.get("model")
    if model_label:
        model = _resolve_model(model_label)
        if model is None:
            return 0
        try:
            qs = model.objects.all()
            filters = card.get("filters") or {}
            if filters:
                qs = qs.filter(**filters)
            return int(qs.count())
        except Exception:
            return 0

    return int(card.get("value", 0))


def _model_admin_url(model_label):
    try:
        app_label, model_name = model_label.split(".")
        return reverse(f"admin:{app_label}_{model_name.lower()}_changelist")
    except Exception:
        return None


ICON_MAP = {
    "users": "fa-solid fa-users",
    "wallet": "fa-solid fa-wallet",
    "receipt": "fa-solid fa-file-invoice-dollar",
    "image": "fa-solid fa-image",
    "withdrawal": "fa-solid fa-money-bill-transfer",
    "coupon": "fa-solid fa-ticket-simple",
    "ticket": "fa-solid fa-ticket",
    "kyc": "fa-solid fa-id-card",
    "stat": "fa-solid fa-chart-line",
}


def icon_class(key: str) -> str:
    return ICON_MAP.get((key or "stat"), "fa-solid fa-chart-line")


@register.inclusion_tag("admin/_cards.html", takes_context=True)
def admin_render_cards(context):
    """
    Renders dashboard cards. Each card dict supports:
      - title: str
      - model: "app.Model" to count (optional)
      - filters: dict for queryset filtering (optional)
      - func: dotted callable returning int (optional)
      - value: literal fallback value (optional)
      - icon: str key mapped to CSS icon class
      - color: one of primary|secondary|accent|danger|muted (extendable)
      - url: explicit URL. If omitted and model is set, links to model changelist.
    """
    brand = _get_brand()
    cards = []
    for c in _get_cards():
        item = {
            "title": c.get("title", "Metric"),
            "icon_class": icon_class(c.get("icon", "stat")),
            "color": c.get("color", "primary"),
            "value": _compute_value(c),
        }

        # Destination
        if c.get("url"):
            item["url"] = c["url"]
        elif c.get("model"):
            item["url"] = _model_admin_url(c["model"]) or "#"
        else:
            item["url"] = "#"

        cards.append(item)

    return {"cards": cards, "ADMIN_BRAND": brand}


# === Sidebar menu (moved here to avoid separate library load issues) ===

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
      - If spec looks like a URL name, attempt reverse().
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
        {"title": "Dashboard", "icon": "fa-solid fa-gauge", "url": "/admin/"},
        {"title": "Genealogy", "icon": "fa-solid fa-sitemap", "url": "#"},
        {"title": "Users", "icon": "fa-solid fa-users", "url": "accounts.CustomUser"},
        {"title": "Products", "icon": "fa-solid fa-box", "url": "market.Product"},
        {"title": "Banners", "icon": "fa-solid fa-image", "url": "market.Banner"},
        {"title": "Orders", "icon": "fa-solid fa-clipboard-list", "url": "market.PurchaseRequest"},
        {"title": "Uploads", "icon": "fa-solid fa-upload", "url": "uploads.Upload"},
        {"title": "Dashboard Cards", "icon": "fa-solid fa-border-all", "url": "#"},
        {"title": "Home Cards", "icon": "fa-solid fa-house", "url": "#"},
        {"title": "Lucky Draw", "icon": "fa-solid fa-ticket", "url": "#"},
        {"title": "KYC", "icon": "fa-solid fa-id-card", "url": "accounts.UserKYC"},
        {"title": "Withdrawals", "icon": "fa-solid fa-money-bill-transfer", "url": "accounts.WithdrawalRequest"},
        {"title": "E‑Coupons", "icon": "fa-solid fa-ticket-simple", "url": "coupons.CouponSubmission"},
        {"title": "Business", "icon": "fa-solid fa-briefcase", "url": "#"},
        {"title": "Reports", "icon": "fa-solid fa-chart-line", "url": "#"},
        {"title": "5‑Matrix", "icon": "fa-solid fa-diagram-project", "url": "#"},
        {"title": "3‑Matrix", "icon": "fa-solid fa-diagram-project", "url": "#"},
        {"title": "Auto Commission", "icon": "fa-solid fa-sack-dollar", "url": "#"},
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
            if not it.get("url"):
                item["url"] = "#"
        norm.append(item)
    return norm


def mark_active(menu, current_path):
    """
    Mark active items based on current_path. An item is active if the current
    request path starts with the item's URL. Children bubble up to parent.
    """
    for item in menu:
        item_url = item.get("url") or ""
        item["active"] = bool(item_url and current_path.startswith(item_url))
        children = item.get("children") or []
        for child in children:
            c_url = child.get("url") or ""
            child["active"] = bool(c_url and current_path.startswith(c_url))
            if child["active"]:
                item["active"] = True
    return menu


@register.simple_tag
def admin_weekly_new_users():
    """
    Return last 7 days of new users as a JSON string:
    {"labels": ["Nov 05", ...], "data": [10, ...]}
    """
    from django.utils import timezone
    from datetime import timedelta
    import json
    CustomUser = apps.get_model("accounts", "CustomUser")
    today = timezone.localdate()
    labels, data = [], []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        next_day = day + timedelta(days=1)
        labels.append(day.strftime("%b %d"))
        try:
            count = CustomUser.objects.filter(date_joined__gte=day, date_joined__lt=next_day).count()
        except Exception:
            count = 0
        data.append(int(count))
    return json.dumps({"labels": labels, "data": data})


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

    request = context.get("request")
    current_path = getattr(request, "path", "")
    menu = mark_active(normalize_items(items), current_path)
    return {
        "menu": menu,
        "current_path": current_path,
        "ADMIN_BRAND": context.get("ADMIN_BRAND"),
    }

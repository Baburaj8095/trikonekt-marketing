from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.html import escape

from .models import InvoiceSettings, PackageInvoice, PromoPurchase


def is_consumer_prime_purchase(purchase):
    user = getattr(purchase, "user", None)
    package = getattr(purchase, "package", None)
    if not user or not package:
        return False
    if str(getattr(purchase, "status", "") or "").upper() != "APPROVED":
        return False
    if str(getattr(package, "type", "") or "").upper() != "PRIME":
        return False
    category = str(getattr(user, "category", "") or "").lower()
    role = str(getattr(user, "role", "") or "").lower()
    return category == "consumer" and role == "user"


def active_invoice_settings():
    obj = InvoiceSettings.objects.filter(is_active=True).order_by("-updated_at", "-id").first()
    if obj:
        return obj
    return InvoiceSettings.objects.create(company_name="Trikonekt", is_active=True)


def invoice_logo_url(config):
    logo = getattr(config, "logo", None)
    if logo:
        try:
            return logo.url
        except Exception:
            pass
    static_url = (getattr(settings, "STATIC_URL", None) or "/static/").rstrip("/")
    return f"{static_url}/branding/TRIKONEKT.jpeg"


def next_invoice_number(prefix):
    year = timezone.localdate().year
    base = f"{prefix}{year}/"
    last = PackageInvoice.objects.filter(invoice_number__startswith=base).order_by("-id").first()
    if last:
        try:
            serial = int(str(last.invoice_number).rsplit("/", 1)[-1]) + 1
        except Exception:
            serial = last.id + 1
    else:
        serial = 1
    return f"{base}{serial:05d}"


@transaction.atomic
def ensure_invoice_for_purchase(purchase):
    purchase = PromoPurchase.objects.select_related("user", "user__city", "user__state", "package").get(pk=purchase.pk)
    if not is_consumer_prime_purchase(purchase):
        return None

    existing = PackageInvoice.objects.filter(promo_purchase=purchase).first()
    if existing:
        return existing

    config = active_invoice_settings()
    user = purchase.user
    package = purchase.package

    total = Decimal(str(getattr(purchase, "amount_paid", "0") or "0")).quantize(Decimal("0.01"))
    gst_percent = Decimal(str(getattr(config, "gst_percent", "0") or "0")).quantize(Decimal("0.01"))
    if gst_percent > 0:
        taxable = (total / (Decimal("1.00") + (gst_percent / Decimal("100.00")))).quantize(Decimal("0.01"))
    else:
        taxable = total
    gst_amount = (total - taxable).quantize(Decimal("0.01"))

    return PackageInvoice.objects.create(
        promo_purchase=purchase,
        invoice_number=next_invoice_number(getattr(config, "invoice_prefix", "") or "TRK/INV/"),
        invoice_date=getattr(purchase, "approved_at", None) or timezone.now(),
        company_name=getattr(config, "company_name", "") or "Trikonekt",
        company_gst_number=getattr(config, "gst_number", "") or "",
        company_address=getattr(config, "company_address", "") or "",
        company_phone=getattr(config, "company_phone", "") or "",
        company_email=getattr(config, "company_email", "") or "",
        logo_url=invoice_logo_url(config),
        consumer_name=getattr(user, "full_name", "") or getattr(user, "username", "") or "",
        consumer_phone=getattr(user, "phone", "") or "",
        consumer_username=getattr(user, "username", "") or "",
        consumer_address=getattr(user, "address", "") or "",
        consumer_city=getattr(getattr(user, "city", None), "name", "") or "",
        consumer_state=getattr(getattr(user, "state", None), "name", "") or "",
        consumer_pincode=getattr(user, "pincode", "") or "",
        package_name=getattr(package, "name", "") or getattr(package, "code", "") or "Prime Package",
        package_code=getattr(package, "code", "") or "",
        quantity=max(1, int(getattr(purchase, "quantity", 1) or 1)),
        taxable_amount=taxable,
        gst_percent=gst_percent,
        gst_amount=gst_amount,
        total_amount=total,
        payment_mode=getattr(purchase, "payment_mode", "") or "",
        footer_text=getattr(config, "footer_text", "") or "",
    )


def invoice_payload(inv):
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_date": inv.invoice_date,
        "package_name": inv.package_name,
        "package_code": inv.package_code,
        "quantity": inv.quantity,
        "taxable_amount": str(inv.taxable_amount),
        "gst_percent": str(inv.gst_percent),
        "gst_amount": str(inv.gst_amount),
        "total_amount": str(inv.total_amount),
        "payment_mode": inv.payment_mode,
        "consumer_name": inv.consumer_name,
        "consumer_phone": inv.consumer_phone,
        "purchase_id": inv.promo_purchase_id,
    }


def invoice_html(inv):
    def money(value):
        try:
            return f"{Decimal(str(value or 0)):.2f}"
        except Exception:
            return "0.00"

    bill_to = "<br/>".join(
        escape(x)
        for x in [
            inv.consumer_name,
            f"Consumer ID: {inv.consumer_username}" if inv.consumer_username else "",
            f"Phone: {inv.consumer_phone}" if inv.consumer_phone else "",
            inv.consumer_address,
            " ".join(x for x in [inv.consumer_city, inv.consumer_state, inv.consumer_pincode] if x),
        ]
        if x
    )
    company_lines = "<br/>".join(
        escape(x)
        for x in [
            inv.company_name,
            f"GST: {inv.company_gst_number}" if inv.company_gst_number else "",
            inv.company_address,
            f"Phone: {inv.company_phone}" if inv.company_phone else "",
            f"Email: {inv.company_email}" if inv.company_email else "",
        ]
        if x
    )
    logo = f'<img src="{escape(inv.logo_url)}" class="logo" />' if inv.logo_url else ""
    date_text = timezone.localtime(inv.invoice_date).strftime("%d %b %Y, %I:%M %p")

    return f"""
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page {{ size: A4; margin: 24mm 18mm; }}
    body {{ font-family: Helvetica, Arial, sans-serif; color: #0f172a; font-size: 12px; }}
    .header {{ display: table; width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 14px; }}
    .brand, .meta {{ display: table-cell; vertical-align: top; width: 50%; }}
    .meta {{ text-align: right; }}
    .logo {{ height: 58px; margin-bottom: 8px; }}
    h1 {{ margin: 0 0 8px; font-size: 24px; }}
    .muted {{ color: #64748b; }}
    .block {{ margin-top: 22px; }}
    .bill {{ border: 1px solid #e2e8f0; padding: 12px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 18px; }}
    th {{ background: #f8fafc; text-align: left; }}
    th, td {{ border: 1px solid #e2e8f0; padding: 9px; }}
    .right {{ text-align: right; }}
    .total {{ font-size: 15px; font-weight: bold; }}
    .footer {{ margin-top: 28px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">{logo}<div>{company_lines}</div></div>
    <div class="meta">
      <h1>TAX INVOICE</h1>
      <div><b>Invoice No:</b> {escape(inv.invoice_number)}</div>
      <div><b>Date:</b> {escape(date_text)}</div>
      <div><b>Payment:</b> {escape(inv.payment_mode or "-")}</div>
    </div>
  </div>

  <div class="block bill">
    <b>Bill To</b><br/>
    {bill_to or "-"}
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Taxable</th>
        <th class="right">GST</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>{escape(inv.package_name)}<br/><span class="muted">{escape(inv.package_code or "")}</span></td>
        <td class="right">{inv.quantity}</td>
        <td class="right">Rs. {money(inv.taxable_amount)}</td>
        <td class="right">Rs. {money(inv.gst_amount)} ({money(inv.gst_percent)}%)</td>
        <td class="right">Rs. {money(inv.total_amount)}</td>
      </tr>
      <tr>
        <td colspan="4" class="right total">Grand Total</td>
        <td class="right total">Rs. {money(inv.total_amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="footer">{escape(inv.footer_text or "")}</div>
</body>
</html>
"""

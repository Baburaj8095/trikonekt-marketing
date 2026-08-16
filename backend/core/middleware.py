from typing import Callable


class CsrfExemptApiMiddleware:
    """
    Exempt CSRF checks for API endpoints.

    Why:
    - This project authenticates API requests with JWT Bearer tokens, not Django sessions.
    - DRF views are typically csrf_exempt, but enforcing a blanket exemption for /api/*
      avoids edge cases where CsrfViewMiddleware may still intervene (e.g., proxies, non-DRF handlers).
    Scope:
    - Only paths starting with /api/ are exempted. Admin and any non-API pages remain protected.
    """

    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        path = getattr(request, "path", "") or ""
        if path.startswith("/api/"):
            # Signal Django's CsrfViewMiddleware to skip CSRF enforcement for this request
            setattr(request, "_dont_enforce_csrf", True)
        return self.get_response(request)


class CharsetUTF8Middleware:
    """
    Ensure all text/html and application/json responses explicitly declare UTF-8.
    Applied globally to avoid any intermediary/proxy/browser mis-decoding.
    """
    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        try:
            ctype = (response.get("Content-Type") or "").lower()
            if ctype.startswith("application/json") and "charset=" not in ctype:
                response["Content-Type"] = "application/json; charset=utf-8"
            elif ctype.startswith("text/html") and "charset=" not in ctype:
                response["Content-Type"] = "text/html; charset=utf-8"
        except Exception:
            # Don't break responses if header probing fails
            pass
        return response


class MaintenanceMiddleware:
    """
    Globally intercept requests and return a 503 Service Unavailable response
    when MAINTENANCE_MODE is set to True in settings or environment variables.
    Exempts admin console so administrative functions remain accessible.
    """
    def __init__(self, get_response: Callable):
        self.get_response = get_response

    def __call__(self, request):
        import os
        from django.http import JsonResponse, HttpResponse
        
        path = getattr(request, "path", "") or ""
        
        # Check environment variable
        is_maintenance = os.environ.get("MAINTENANCE_MODE", "False").lower() in ("true", "1", "yes")
        host = request.get_host().lower() if hasattr(request, "get_host") else ""
        is_admin_request = path.startswith("/admin/") or path.startswith("/healthz") or host.startswith("admin.")
        
        if is_maintenance and not is_admin_request:
            if path.startswith("/api/"):
                return JsonResponse(
                    {"detail": "The server is currently undergoing scheduled maintenance. Please try again later."},
                    status=503
                )
            else:
                html_content = """
                <!DOCTYPE html>
                <html>
                <head>
                    <title>System Maintenance</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body { text-align: center; padding: 100px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; background-color: #f7f9fa; }
                        h1 { font-size: 40px; margin-bottom: 20px; color: #1a1a1a; }
                        p { font-size: 18px; line-height: 1.6; color: #555; max-width: 600px; margin: 0 auto 30px auto; }
                        .logo { font-weight: bold; font-size: 24px; color: #0066cc; margin-bottom: 40px; display: inline-block; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <div class="logo">Trikonekt</div>
                    <h1>Scheduled Maintenance</h1>
                    <p>We are currently performing scheduled system updates to improve performance and reliability. We will be back online shortly. Thank you for your patience!</p>
                </body>
                </html>
                """
                return HttpResponse(html_content, status=503)
                
        return self.get_response(request)

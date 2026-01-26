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

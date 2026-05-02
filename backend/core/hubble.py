"""core.hubble

Minimal integration helpers for Hubble Gift Card SDK:

- JWT SSO token generation (RS256) as per Hubble docs.
- Webhook signature verification helper (HMAC-SHA256 base64) for X-Verify.

We keep this in `core/` to avoid circular imports with app modules.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any, Dict, Optional

from django.conf import settings


def _load_private_key_pem() -> str:
    pem = (getattr(settings, "HUBBLE_JWT_PRIVATE_KEY_PEM", "") or "").strip()
    if pem:
        return pem

    path = (getattr(settings, "HUBBLE_JWT_PRIVATE_KEY_PATH", "") or "").strip()
    if not path:
        return ""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return (f.read() or "").strip()
    except Exception:
        return ""


def generate_hubble_sso_jwt(*, subject: str, name: str = "", email: str = "", phone_number: str = "", cohorts: Optional[list[str]] = None) -> str:
    """Generate a short-lived (60s) RS256 JWT for Hubble SSO.

    Expected payload example from Hubble docs:
      {
        "sub": "user_123",
        "iss": "partner-client-id",
        "iat": 1711929600,
        "exp": 1711929660,
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "919999912345",
        "cohorts": ["premium", "beta"]
      }
    """
    import time

    client_id = (getattr(settings, "HUBBLE_CLIENT_ID", "") or "").strip()
    priv = _load_private_key_pem()
    if not client_id:
        raise ValueError("HUBBLE_CLIENT_ID is not configured")
    if not priv:
        raise ValueError("HUBBLE_JWT_PRIVATE_KEY_PEM/PATH is not configured")

    iat = int(time.time())
    exp = iat + 60
    payload: Dict[str, Any] = {
        "sub": str(subject),
        "iss": client_id,
        "iat": iat,
        "exp": exp,
    }
    if name:
        payload["name"] = str(name)
    if email:
        payload["email"] = str(email)
    if phone_number:
        payload["phoneNumber"] = str(phone_number)
    if cohorts:
        payload["cohorts"] = list(cohorts)

    try:
        import jwt  # PyJWT
    except Exception as e:
        raise RuntimeError("PyJWT is not installed") from e

    token = jwt.encode(payload, priv, algorithm="RS256")
    # PyJWT may return bytes in older versions
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    return token


def build_hubble_web_sdk_url(*, token: str) -> str:
    """Return the URL used in iframe src.

    Partner setups differ:
    - Some require only: clientId + token
    - Some require: clientId + clientSecret + token (+ theme)

    SECURITY NOTE:
    If you pass a clientSecret via query params, it will be visible in the browser.
    Prefer server-side-only flows if Hubble supports them.
    """
    base = (getattr(settings, "HUBBLE_SDK_BASE_URL", "") or "").rstrip("/")
    client_id = (getattr(settings, "HUBBLE_CLIENT_ID", "") or "").strip()
    client_secret = (getattr(settings, "HUBBLE_CLIENT_SECRET", "") or "").strip()
    theme = (getattr(settings, "HUBBLE_SDK_THEME", "") or "").strip()

    # Backward-compat: older env var name
    app_secret = (getattr(settings, "HUBBLE_APP_SECRET", "") or "").strip()
    if not client_secret and app_secret:
        client_secret = app_secret

    # SECURITY: do not send partner secrets to the browser unless explicitly allowed.
    # Default is OFF for safety; enable only if Hubble explicitly requires it.
    send_secret = str(getattr(settings, "HUBBLE_SEND_CLIENT_SECRET_TO_BROWSER", "") or "").lower() in (
        "1",
        "true",
        "yes",
    )
    if not base:
        raise ValueError("HUBBLE_SDK_BASE_URL is not configured")
    if not client_id:
        raise ValueError("HUBBLE_CLIENT_ID is not configured")
    if not token:
        raise ValueError("token is required")

    # Construct query string safely
    from urllib.parse import urlencode

    params = {"clientId": client_id, "token": token}
    if client_secret and send_secret:
        # Hubble docs sometimes call this 'clientSecret'
        params["clientSecret"] = client_secret
    if theme:
        params["theme"] = theme
    return f"{base}/?{urlencode(params)}"


def verify_hubble_webhook(*, raw_body: bytes, x_verify: str) -> bool:
    """Verify X-Verify signature for Hubble webhooks.

    Hubble docs: X-Verify is base64(HMAC_SHA256(raw_body, webhook_secret)).
    """
    secret = (getattr(settings, "HUBBLE_WEBHOOK_SECRET", "") or "").encode("utf-8")
    if not secret:
        return False
    if not x_verify:
        return False

    expected = hmac.new(secret, raw_body or b"", hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode("utf-8")
    # constant-time compare
    try:
        return hmac.compare_digest(expected_b64, str(x_verify))
    except Exception:
        return False

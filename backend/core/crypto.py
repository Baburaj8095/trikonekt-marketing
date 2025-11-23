import os
import base64
from typing import Optional
try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:  # cryptography may not be installed yet
    Fernet = None  # type: ignore
    InvalidToken = Exception  # type: ignore


def _get_fernet() -> Optional["Fernet"]:
    """
    Return a Fernet instance using PASSWORD_ENC_KEY from environment.
    The key must be a urlsafe base64-encoded 32-byte key (Fernet.generate_key()).
    If a raw 32-byte string is provided, attempt to urlsafe-b64-encode it.
    When key is missing or cryptography not installed, returns None.
    """
    if Fernet is None:
        return None

    key = os.environ.get("PASSWORD_ENC_KEY") or os.environ.get("PASSWORD_ENCRYPTION_KEY")
    if not key:
        return None
    try:
        key_bytes = key.encode("utf-8") if isinstance(key, str) else key
        try:
            # Try as-is first
            return Fernet(key_bytes)
        except Exception:
            # If it looks like raw 32 bytes, try to wrap in urlsafe b64
            if isinstance(key_bytes, (bytes, bytearray)) and len(key_bytes) == 32:
                k2 = base64.urlsafe_b64encode(key_bytes)
                return Fernet(k2)
            # If it's a hex string of 32 bytes, try decoding hex and then b64
            try:
                raw = bytes.fromhex(key)  # type: ignore[arg-type]
                if len(raw) == 32:
                    k3 = base64.urlsafe_b64encode(raw)
                    return Fernet(k3)
            except Exception:
                pass
    except Exception:
        return None
    return None


def encrypt_string(plain: Optional[str]) -> Optional[str]:
    """
    Encrypt a string using Fernet and return a base64 token. Returns None if
    encryption key is missing or cryptography is not installed.
    """
    if plain is None:
        return None
    f = _get_fernet()
    if not f:
        return None
    try:
        token = f.encrypt(plain.encode("utf-8"))
        return token.decode("utf-8")
    except Exception:
        return None


def decrypt_string(token: Optional[str]) -> Optional[str]:
    """
    Decrypt a Fernet token string and return plaintext. Returns None on any error,
    including missing key or invalid token.
    """
    if not token:
        return None
    f = _get_fernet()
    if not f:
        return None
    try:
        out = f.decrypt(token.encode("utf-8"))
        return out.decode("utf-8")
    except (InvalidToken, Exception):
        return None

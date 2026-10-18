"""
Minimal RFC 6238 TOTP implementation (HMAC-SHA1, 30s step, 6 digits).

Compatible with Google Authenticator, 1Password, Authy, etc.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

STEP_SECONDS = 30
DIGITS = 6
ISSUER = "Sentient Flow"


def generate_secret() -> str:
    """Return a random 160-bit base32 secret (no padding)."""
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _hotp(secret: str, counter: int) -> str:
    padded = secret + "=" * (-len(secret) % 8)
    key = base64.b32decode(padded, casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(code % 10**DIGITS).zfill(DIGITS)


def generate_code(secret: str, at: float | None = None) -> str:
    counter = int((time.time() if at is None else at) // STEP_SECONDS)
    return _hotp(secret, counter)


def verify_code(secret: str, code: str, window: int = 1) -> bool:
    """Check a code, allowing +/- `window` steps of clock drift."""
    code = code.strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return False
    counter = int(time.time() // STEP_SECONDS)
    return any(
        hmac.compare_digest(_hotp(secret, counter + drift), code)
        for drift in range(-window, window + 1)
    )


def provisioning_uri(secret: str, account: str) -> str:
    label = quote(f"{ISSUER}:{account}")
    params = urlencode({"secret": secret, "issuer": ISSUER, "digits": DIGITS})
    return f"otpauth://totp/{label}?{params}"

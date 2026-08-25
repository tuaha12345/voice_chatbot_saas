from __future__ import annotations

from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
import secrets

import jwt

from app.config import settings


def hash_secret(value: str) -> str:
    salt = secrets.token_hex(16)
    digest = pbkdf2_hmac("sha256", value.encode(), salt.encode(), 120_000).hex()
    return f"{salt}${digest}"


def verify_secret(value: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$", 1)
    except ValueError:
        return False
    check = pbkdf2_hmac("sha256", value.encode(), salt.encode(), 120_000).hex()
    return secrets.compare_digest(check, digest)


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        settings.jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def new_public_key() -> str:
    return "pk_" + secrets.token_urlsafe(18)


def new_agent_secret() -> str:
    return "sk_" + secrets.token_urlsafe(24)

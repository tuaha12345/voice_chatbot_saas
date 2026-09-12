from __future__ import annotations

from urllib.parse import urlparse

from app.config import settings


def normalize_origin(value: str | None) -> str | None:
    """Return scheme://host[:port] or None if empty/invalid shape."""
    raw = (value or "").strip().rstrip("/")
    if not raw:
        return None
    try:
        parsed = urlparse(raw)
    except Exception:
        return None
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        return None
    # Origin must be scheme + netloc only (no path/query/userinfo).
    if parsed.path not in ("", "/") or parsed.params or parsed.query or parsed.fragment:
        return None
    if parsed.username or parsed.password:
        return None
    host = (parsed.hostname or "").strip().lower()
    if not host:
        return None
    # Reject opaque / null-like values
    if host in ("null", "undefined"):
        return None
    netloc = parsed.netloc.lower()
    if "@" in netloc:
        return None
    return f"{scheme}://{netloc}"


def is_valid_browser_origin(origin: str | None) -> bool:
    """True if Origin is a well-formed browser origin safe to reflect for CORS."""
    normalized = normalize_origin(origin)
    if not normalized:
        return False
    parsed = urlparse(normalized)
    host = (parsed.hostname or "").lower()
    is_loopback = host in ("localhost", "127.0.0.1", "::1")
    if settings.is_production:
        # Production embeds must be HTTPS (no http:// attacker sites).
        if parsed.scheme != "https":
            return False
        if is_loopback:
            return False
    else:
        if parsed.scheme == "http" and not is_loopback:
            # Dev: only allow http on loopback; other hosts should use https.
            return False
    return True


def parse_allowed_origins(allowed: str | None) -> list[str]:
    """Parse and sanitize a comma-separated allowlist. Drops invalid entries."""
    text = (allowed or "").strip()
    if not text:
        return []
    if text == "*":
        # Wildcard only usable in development (checked by origin_allowed).
        return ["*"] if settings.is_development else []
    out: list[str] = []
    seen: set[str] = set()
    for part in text.split(","):
        normalized = normalize_origin(part)
        if not normalized or not is_valid_browser_origin(normalized):
            continue
        if normalized in seen:
            continue
        seen.add(normalized)
        out.append(normalized)
    return out


def sanitize_allowed_origins_input(allowed: str | None) -> str:
    """Normalize agent allowlist for storage. Rejects bare * in production."""
    text = (allowed or "").strip()
    if not text:
        return ""
    if text == "*":
        if settings.is_development:
            return "*"
        raise ValueError(
            "Wildcard (*) allowed origins are not permitted in production. "
            "List exact HTTPS origins, e.g. https://example.com"
        )
    parts = parse_allowed_origins(text)
    if not parts:
        raise ValueError(
            "No valid origins. Use exact origins like https://example.com "
            "(comma-separated). Paths and wildcards are not allowed."
        )
    return ",".join(parts)


def origin_allowed(allowed: str, origin: str | None) -> bool:
    """Application-level embed allowlist check (real security boundary)."""
    normalized = normalize_origin(origin)
    if not normalized:
        return False
    if not is_valid_browser_origin(normalized):
        return False
    allowlist = parse_allowed_origins(allowed)
    if not allowlist:
        return False
    if allowlist == ["*"]:
        return settings.is_development
    return normalized in allowlist


def resolve_request_origin(header_origin: str | None, body_origin: str | None) -> str | None:
    """
    Prefer the browser Origin header (not spoofable by page JS).
    If body also sends origin, require an exact match to detect tampering.
    """
    header = normalize_origin(header_origin)
    body = normalize_origin(body_origin)
    if header and body and header != body:
        return None
    return header or body

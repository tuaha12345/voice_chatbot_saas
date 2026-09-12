from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

from app.config import settings

_BLOCKED_HOSTS = frozenset(
    {
        "metadata.google.internal",
        "metadata.google.com",
        "instance-data",
    }
)


def validate_webhook_url(url: str) -> str:
    """Return a sanitized webhook URL or raise ValueError if unsafe."""
    url = (url or "").strip()
    if not url:
        return ""

    parsed = urlparse(url)
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").strip().lower()
    if not host or not scheme:
        raise ValueError("Invalid webhook URL")

    if host in _BLOCKED_HOSTS:
        raise ValueError("Webhook URL host is not allowed")

    is_local_dev_target = host in ("localhost", "127.0.0.1", "::1")
    if scheme == "https":
        pass
    elif scheme == "http" and settings.is_development and is_local_dev_target:
        pass
    else:
        raise ValueError("Webhook URL must use HTTPS")

    port = parsed.port or (443 if scheme == "https" else 80)
    try:
        addr_infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError("Webhook host could not be resolved") from exc

    if not addr_infos:
        raise ValueError("Webhook host could not be resolved")

    for info in addr_infos:
        ip = ipaddress.ip_address(info[4][0])
        if _ip_blocked(ip, allow_loopback=settings.is_development and is_local_dev_target):
            raise ValueError("Webhook URL points to a private or blocked address")

    return url


def _ip_blocked(ip: ipaddress.IPv4Address | ipaddress.IPv6Address, *, allow_loopback: bool) -> bool:
    if allow_loopback and ip.is_loopback:
        return False
    return bool(
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )

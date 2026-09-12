from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request


class RateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            cutoff = now - self.window_seconds
            recent = [t for t in self._hits[key] if t > cutoff]
            if len(recent) >= self.max_attempts:
                self._hits[key] = recent
                raise HTTPException(
                    status_code=429,
                    detail="Too many attempts. Try again later.",
                )
            recent.append(now)
            self._hits[key] = recent


auth_limiter = RateLimiter(max_attempts=10, window_seconds=15 * 60)
# Public widget session minting — tighter than auth but enough for real visitors.
widget_session_limiter = RateLimiter(max_attempts=30, window_seconds=60)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"

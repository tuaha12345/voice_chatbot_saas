from __future__ import annotations

from starlette.datastructures import Headers, MutableHeaders
from starlette.responses import Response
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings
from app.origin_security import is_valid_browser_origin, normalize_origin


WIDGET_API_PREFIX = "/v1/widget"


def _dashboard_origins() -> set[str]:
    origins = {settings.web_origin.rstrip("/")}
    if settings.is_development:
        origins.update({"http://localhost:3000", "http://127.0.0.1:3000"})
    return {o for o in (normalize_origin(x) for x in origins) if o}


class SecureCORSMiddleware:
    """
    Path-aware CORS:
    - Dashboard/API: only WEB_ORIGIN (+ local dashboard in development), with credentials.
    - Widget API (/v1/widget/*): reflect well-formed browser Origins without credentials.
      Real authorization is agent.allowed_origins on the route (preflight cannot know the key).
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        self.dashboard_origins = _dashboard_origins()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "") or ""
        headers = Headers(scope=scope)
        origin = headers.get("origin")
        method = scope.get("method", "GET").upper()
        is_widget = path.startswith(WIDGET_API_PREFIX)

        if is_widget:
            allow_origin = origin if is_valid_browser_origin(origin) else None
            allow_credentials = False
            allow_methods = "GET, POST, OPTIONS"
            allow_headers = "Content-Type"
        else:
            normalized = normalize_origin(origin)
            allow_origin = normalized if normalized and normalized in self.dashboard_origins else None
            allow_credentials = True
            allow_methods = "DELETE, GET, HEAD, OPTIONS, PATCH, POST, PUT"
            allow_headers = "Authorization, Content-Type"

        if method == "OPTIONS" and origin:
            # Preflight: only answer when we would allow this origin.
            if not allow_origin:
                response = Response(status_code=400)
                await response(scope, receive, send)
                return
            response = Response(status_code=204)
            response.headers["Access-Control-Allow-Origin"] = allow_origin
            response.headers["Access-Control-Allow-Methods"] = allow_methods
            response.headers["Access-Control-Allow-Headers"] = allow_headers
            response.headers["Access-Control-Max-Age"] = "600"
            response.headers["Vary"] = "Origin"
            if allow_credentials:
                response.headers["Access-Control-Allow-Credentials"] = "true"
            await response(scope, receive, send)
            return

        async def send_with_cors(message: Message) -> None:
            if message["type"] == "http.response.start" and allow_origin:
                headers_out = MutableHeaders(scope=message)
                headers_out["Access-Control-Allow-Origin"] = allow_origin
                headers_out.append("Vary", "Origin")
                if allow_credentials:
                    headers_out["Access-Control-Allow-Credentials"] = "true"
            await send(message)

        await self.app(scope, receive, send_with_cors)

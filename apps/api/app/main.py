from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text

from app.config import settings
from app.cors_middleware import SecureCORSMiddleware
from app.database import Base, engine
from app.bootstrap import bootstrap_admin
from app.routers import (
    agents,
    admin,
    auth,
    booking,
    conversations,
    internal,
    knowledge,
    me,
    orders,
    products,
    site_pages,
    tickets,
    webhooks,
    widget,
)

_PLACEHOLDER_JWT = "change-me-to-a-long-random-string"
_PLACEHOLDER_INTERNAL = "change-me-internal-agent-secret"


def assert_production_secrets() -> None:
    if not settings.is_production:
        return
    bad: list[str] = []
    if not settings.jwt_secret or settings.jwt_secret == _PLACEHOLDER_JWT:
        bad.append("JWT_SECRET")
    if not settings.internal_agent_secret or settings.internal_agent_secret == _PLACEHOLDER_INTERNAL:
        bad.append("INTERNAL_AGENT_SECRET")
    if bad:
        raise RuntimeError(
            "Insecure placeholder secrets are not allowed in production: " + ", ".join(bad)
        )


app = FastAPI(
    title="Voice Chatbot SaaS API",
    version="0.1.0",
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
)

# Path-aware CORS: dashboard stays locked to WEB_ORIGIN; widget uses
# agent.allowed_origins for real auth (see SecureCORSMiddleware).
app.add_middleware(SecureCORSMiddleware)

app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(knowledge.router)
app.include_router(conversations.router)
app.include_router(widget.router)
app.include_router(internal.router)
app.include_router(booking.dash)
app.include_router(booking.internal)
app.include_router(orders.dash)
app.include_router(orders.internal)
app.include_router(tickets.dash)
app.include_router(tickets.internal)
app.include_router(webhooks.dash)
app.include_router(products.dash)
app.include_router(products.internal)
app.include_router(site_pages.dash)
app.include_router(me.router)
app.include_router(admin.router)

Base.metadata.create_all(bind=engine)
from app.database import patch_mysql_columns

patch_mysql_columns()

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup():
    assert_production_secrets()
    Base.metadata.create_all(bind=engine)
    for stmt in (
        "ALTER TABLE users ADD COLUMN plan_minutes INT DEFAULT 120",
        "ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0",
        "ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT 1",
        "ALTER TABLE agents ADD COLUMN realtime_model VARCHAR(128) DEFAULT 'gpt-4o-realtime-preview'",
        "ALTER TABLE agents ADD COLUMN character_enabled BOOLEAN DEFAULT 0",
        "ALTER TABLE agents ADD COLUMN character_pack VARCHAR(64) DEFAULT 'character_emoji'",
        "ALTER TABLE agents ADD COLUMN launcher_mode VARCHAR(16) DEFAULT 'mic'",
        "ALTER TABLE agents ADD COLUMN launcher_skin VARCHAR(64) NULL",
        "ALTER TABLE agents ADD COLUMN launcher_label VARCHAR(80) DEFAULT 'Tap to talk with AI'",
        "ALTER TABLE agents ADD COLUMN launcher_color VARCHAR(16) DEFAULT '#2563eb'",
        "ALTER TABLE agents ADD COLUMN launcher_size INT DEFAULT 160",
        "ALTER TABLE agents ADD COLUMN character_size INT DEFAULT 200",
        "ALTER TABLE agents ADD COLUMN panel_width INT DEFAULT 280",
        "ALTER TABLE agents ADD COLUMN show_transcription BOOLEAN DEFAULT 0",
        "ALTER TABLE agents ADD COLUMN site_pages TEXT",
        "ALTER TABLE agents ADD COLUMN max_call_minutes INT DEFAULT 10",
    ):
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            pass
    bootstrap_admin()
    try:
        from app.database import SessionLocal
        from app.ai_usage import backfill_ai_usage_from_plan_minutes

        db = SessionLocal()
        try:
            n = backfill_ai_usage_from_plan_minutes(db)
            if n:
                print(f"Backfilled {n} AI usage gap row(s) from plan minutes")
        finally:
            db.close()
    except Exception as exc:
        print(f"AI usage backfill skipped: {exc}")


@app.get("/")
def root():
    return {"ok": True, "service": "voice-chat-api", "env": settings.app_env}


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/widget.js")
def widget_js():
    path = STATIC_DIR / "widget.js"
    if not path.exists():
        fallback = Path(__file__).resolve().parents[2] / "widget" / "widget.js"
        if fallback.exists():
            path = fallback
        else:
            return HTMLResponse("widget.js missing", status_code=404)
    return FileResponse(
        path,
        media_type="application/javascript",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@app.get("/demo", response_class=HTMLResponse)
def demo():
    if not settings.is_development:
        return HTMLResponse("Not found", status_code=404)
    return """<!doctype html>
<html>
<head><meta charset="utf-8"><title>Voice widget demo</title>
<style>body{font-family:system-ui;padding:40px;background:#0f1115;color:#e8eaed}
label{display:block;margin:12px 0 6px}input{width:320px;padding:8px;border-radius:8px;border:1px solid #333;background:#1b1e24;color:#fff}
button{margin-top:12px;padding:8px 14px;border-radius:8px;border:0;background:#6c8cff;color:#fff;cursor:pointer}</style>
</head>
<body>
<h1>Widget demo</h1>
<p>Paste your agent public key, then the floating mic button appears.</p>
<label>Public key</label>
<input id="key" placeholder="pk_..." />
<button id="go">Load widget</button>
<script>
document.getElementById('go').onclick = () => {
  const key = document.getElementById('key').value.trim();
  if (!key) return;
  const s = document.createElement('script');
  s.src = '/widget.js';
  s.dataset.agentKey = key;
  document.body.appendChild(s);
};
</script>
</body></html>"""

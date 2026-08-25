from __future__ import annotations

import json
import logging
import smtplib
from datetime import datetime, timezone
from email.message import EmailMessage

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models import Agent, AgentWebhook

log = logging.getLogger("notify")


def _payload(event: str, agent_id: int, data: dict) -> dict:
    return {
        "event": event,
        "agent_id": agent_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "data": data,
    }


def send_email(to_addr: str, subject: str, body: str) -> None:
    if not settings.smtp_host or not to_addr:
        return
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from or settings.smtp_user or "noreply@localhost"
    msg["To"] = to_addr
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        try:
            smtp.starttls()
        except Exception:
            pass
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


def post_webhook(url: str, secret: str, payload: dict) -> None:
    if not url or not url.strip():
        return
    headers = {"Content-Type": "application/json"}
    if secret:
        headers["X-Webhook-Secret"] = secret
    with httpx.Client(timeout=10) as client:
        client.post(url.strip(), headers=headers, content=json.dumps(payload, default=str))


def notify_event(
    db: Session,
    agent_id: int,
    event: str,
    data: dict,
    guest_email: str = "",
    guest_subject: str = "",
    guest_body: str = "",
) -> None:
    try:
        agent = (
            db.query(Agent)
            .options(joinedload(Agent.user), joinedload(Agent.webhook))
            .filter(Agent.id == agent_id)
            .first()
        )
        if not agent:
            return
        payload = _payload(event, agent_id, data)
        tenant_email = agent.user.email if agent.user else ""
        subject = f"[{agent.name}] {event}"
        body = json.dumps(payload, indent=2, default=str)
        send_email(tenant_email, subject, body)
        if guest_email and guest_subject:
            send_email(guest_email, guest_subject, guest_body or body)
        hook = agent.webhook
        if hook:
            post_webhook(hook.url, hook.secret, payload)
    except Exception:
        log.exception("notify_event failed for %s agent %s", event, agent_id)

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.access import owned_agent
from app.database import get_db
from app.deps import current_user
from app.models import AgentWebhook, User
from app.schemas import WebhookIn, WebhookOut

dash = APIRouter(prefix="/v1/agents/{agent_id}/webhook", tags=["webhooks"])


def _row(db: Session, agent_id: int) -> AgentWebhook:
    row = db.query(AgentWebhook).filter(AgentWebhook.agent_id == agent_id).first()
    if not row:
        row = AgentWebhook(agent_id=agent_id, url="", secret=secrets.token_urlsafe(24))
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@dash.get("", response_model=WebhookOut)
def get_webhook(agent_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    row = _row(db, agent_id)
    return WebhookOut(url=row.url or "", secret=row.secret or "", has_secret=bool(row.secret))


@dash.put("", response_model=WebhookOut)
def put_webhook(
    agent_id: int,
    body: WebhookIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = _row(db, agent_id)
    row.url = (body.url or "").strip()
    db.commit()
    db.refresh(row)
    return WebhookOut(url=row.url or "", secret=row.secret or "", has_secret=bool(row.secret))


@dash.post("/rotate", response_model=WebhookOut)
def rotate_secret(agent_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    row = _row(db, agent_id)
    row.secret = secrets.token_urlsafe(24)
    db.commit()
    db.refresh(row)
    return WebhookOut(url=row.url or "", secret=row.secret or "", has_secret=True)

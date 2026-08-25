from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Agent, UsageEvent, User


def month_start() -> datetime:
    now = datetime.utcnow()
    return datetime(now.year, now.month, 1)


def usage_minutes_for_user(db: Session, user: User) -> float:
    ids = [row[0] for row in db.query(Agent.id).filter(Agent.user_id == user.id).all()]
    if not ids:
        return 0.0
    total = (
        db.query(func.coalesce(func.sum(UsageEvent.minutes), 0))
        .filter(UsageEvent.agent_id.in_(ids), UsageEvent.created_at >= month_start())
        .scalar()
    )
    return float(total or 0)


def plan_exhausted(db: Session, user: User) -> bool:
    cap = user.plan_minutes if user.plan_minutes is not None else 120
    return usage_minutes_for_user(db, user) >= float(cap)

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import Agent, User


def owned_agent(db: Session, user: User | int, agent_id: int) -> Agent:
    """Return agent if user owns it, or if user is platform admin."""
    query = (
        db.query(Agent)
        .options(joinedload(Agent.modules))
        .filter(Agent.id == agent_id)
    )
    if isinstance(user, User):
        if not user.is_admin:
            query = query.filter(Agent.user_id == user.id)
    else:
        # legacy call sites that pass user_id int
        query = query.filter(Agent.user_id == int(user))
    agent = query.first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def get_agent_or_404(db: Session, agent_id: int) -> Agent:
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


def require_module(agent: Agent, name: str) -> None:
    modules = agent.modules
    if not modules or not bool(getattr(modules, name, False)):
        raise HTTPException(status_code=403, detail=f"{name} module is off")

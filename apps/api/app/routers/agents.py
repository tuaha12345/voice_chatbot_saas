from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import current_approved_user
from app.config import settings
from app.models import (
    Agent,
    AgentModule,
    Booking,
    BookingSettings,
    Conversation,
    KnowledgeDoc,
    Message,
    Order,
    Product,
    Ticket,
    AgentWebhook,
    AiUsageEvent,
    UsageEvent,
    User,
)
from app.schemas import AgentCreate, AgentCreatedOut, AgentOut, AgentUpdate, ModulesOut
from app.security import hash_secret, new_agent_secret, new_public_key
from app.origin_security import sanitize_allowed_origins_input

router = APIRouter(prefix="/v1/agents", tags=["agents"])


def _sanitize_origins_or_400(value: str | None) -> str:
    try:
        return sanitize_allowed_origins_input(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _agent_query(db: Session, user: User, agent_id: int) -> Agent:
    query = (
        db.query(Agent)
        .options(joinedload(Agent.modules))
        .filter(Agent.id == agent_id)
    )
    if not user.is_admin:
        query = query.filter(Agent.user_id == user.id)
    agent = query.first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent


@router.get("", response_model=list[AgentOut])
def list_agents(user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    return (
        db.query(Agent)
        .options(joinedload(Agent.modules))
        .filter(Agent.user_id == user.id)
        .order_by(Agent.id.desc())
        .all()
    )


@router.post("", response_model=AgentCreatedOut)
def create_agent(
    body: AgentCreate,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    secret = new_agent_secret()
    prompt = body.system_prompt or (
        "You are a helpful voice assistant. Answer only from the provided knowledge base. "
        "If you do not know, say you do not have that information."
    )
    agent = Agent(
        user_id=user.id,
        name=body.name,
        language=body.language,
        voice=body.voice,
        realtime_model=settings.openai_realtime_model,
        system_prompt=prompt,
        public_key=new_public_key(),
        secret_hash=hash_secret(secret),
        allowed_origins=_sanitize_origins_or_400(body.allowed_origins or ""),
        max_call_minutes=int(body.max_call_minutes or 10),
    )
    db.add(agent)
    db.flush()
    db.add(AgentModule(agent_id=agent.id, qa=True, support=False, booking=False, orders=False))
    db.commit()
    agent = _agent_query(db, user, agent.id)
    out = AgentCreatedOut.model_validate(agent)
    out.secret = secret
    return out


@router.get("/{agent_id}", response_model=AgentOut)
def get_agent(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    return _agent_query(db, user, agent_id)


@router.patch("/{agent_id}", response_model=AgentOut)
def update_agent(
    agent_id: int,
    body: AgentUpdate,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    agent = _agent_query(db, user, agent_id)
    data = body.model_dump(exclude_unset=True)
    modules = data.pop("modules", None)
    if "allowed_origins" in data:
        # Empty string clears the allowlist (widget blocked until set again).
        raw = data["allowed_origins"]
        data["allowed_origins"] = (
            "" if raw is None or str(raw).strip() == "" else _sanitize_origins_or_400(raw)
        )
    for key, value in data.items():
        setattr(agent, key, value)
    if modules is not None:
        if not agent.modules:
            agent.modules = AgentModule(agent_id=agent.id)
        agent.modules.qa = modules["qa"]
        agent.modules.support = modules["support"]
        agent.modules.booking = modules["booking"]
        agent.modules.orders = modules["orders"]
    db.commit()
    return _agent_query(db, user, agent_id)


@router.delete("/{agent_id}")
def delete_agent(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    agent = _agent_query(db, user, agent_id)
    convos = db.query(Conversation).filter(Conversation.agent_id == agent.id).all()
    for convo in convos:
        db.query(Message).filter(Message.conversation_id == convo.id).delete()
        db.delete(convo)
    db.query(KnowledgeDoc).filter(KnowledgeDoc.agent_id == agent.id).delete()
    db.query(UsageEvent).filter(UsageEvent.agent_id == agent.id).delete()
    db.query(AiUsageEvent).filter(AiUsageEvent.agent_id == agent.id).delete()
    db.query(Booking).filter(Booking.agent_id == agent.id).delete()
    db.query(BookingSettings).filter(BookingSettings.agent_id == agent.id).delete()
    db.query(Order).filter(Order.agent_id == agent.id).delete()
    db.query(Ticket).filter(Ticket.agent_id == agent.id).delete()
    db.query(Product).filter(Product.agent_id == agent.id).delete()
    db.query(AgentWebhook).filter(AgentWebhook.agent_id == agent.id).delete()
    db.query(AgentModule).filter(AgentModule.agent_id == agent.id).delete()
    db.delete(agent)
    db.commit()
    return {"ok": True}


@router.get("/{agent_id}/embed")
def embed_snippet(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    from app.config import settings

    agent = _agent_query(db, user, agent_id)
    script = (
        f'<script src="{settings.api_public_url}/widget.js?v=15" '
        f'data-agent-key="{agent.public_key}" async></script>'
    )
    return {
        "public_key": agent.public_key,
        "widget_url": f"{settings.api_public_url}/widget.js?v=15",
        "script": script,
        "wordpress": (
            "Appearance → Theme File Editor → footer.php (or a header/footer plugin). "
            "Paste the script before </body>. The site must be HTTPS for the microphone."
        ),
        "modules": ModulesOut.model_validate(agent.modules) if agent.modules else None,
    }

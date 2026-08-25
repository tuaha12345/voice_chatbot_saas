from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.config import estimate_ai_cost_usd, settings
from app.database import get_db
from app.deps import current_admin
from app.models import (
    Agent,
    AgentModule,
    AgentWebhook,
    AiUsageEvent,
    Booking,
    BookingSettings,
    Conversation,
    KnowledgeDoc,
    Message,
    Order,
    Product,
    Ticket,
    UsageEvent,
    User,
)
from app.realtime_catalog import (
    REALTIME_MODELS,
    REALTIME_PROVIDER,
    REALTIME_VOICES,
    is_valid_model,
    is_valid_voice,
)
from app.openai_costs import fetch_openai_org_costs_month
from app.character_packs import list_packs
from app.schemas import (
    AdminAgentOut,
    AdminAgentUpdate,
    AdminStatsOut,
    AdminUsageOut,
    AdminUsageSummaryOut,
    AdminUserOut,
    AdminUserUpdate,
    CharacterPackOut,
    OpenAiOrgCostsOut,
    RealtimeOptionsOut,
)
from app.security import hash_secret
from app.usage import month_start, usage_minutes_for_user

router = APIRouter(prefix="/v1/admin", tags=["admin"])


def _user_out(db: Session, user: User) -> AdminUserOut:
    agent_count = int(
        db.query(func.count(Agent.id)).filter(Agent.user_id == user.id).scalar() or 0
    )
    used = usage_minutes_for_user(db, user)
    cost = float(
        db.query(func.coalesce(func.sum(AiUsageEvent.cost_usd), 0))
        .filter(
            AiUsageEvent.user_id == user.id,
            AiUsageEvent.created_at >= month_start(),
        )
        .scalar()
        or 0
    )
    # If calls only logged plan minutes (no AI metrics yet), estimate from minutes
    if cost <= 0 and used > 0:
        approx = int(used * 750)
        cost = estimate_ai_cost_usd(audio_input_tokens=approx, audio_output_tokens=approx)
    return AdminUserOut(
        id=user.id,
        email=user.email,
        plan_minutes=user.plan_minutes,
        is_admin=bool(user.is_admin),
        agent_count=agent_count,
        used_minutes=round(used, 2),
        cost_usd_month=round(float(cost or 0), 4),
        created_at=user.created_at,
    )


def _purge_agent(db: Session, agent: Agent) -> None:
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


def _agent_out(agent: Agent, user_email: str = "") -> AdminAgentOut:
    return AdminAgentOut(
        id=agent.id,
        name=agent.name,
        user_id=agent.user_id,
        user_email=user_email,
        public_key=agent.public_key,
        voice=agent.voice or "alloy",
        realtime_model=agent.realtime_model or settings.openai_realtime_model,
        character_enabled=bool(agent.character_enabled),
        character_pack=agent.character_pack or "character_emoji",
        created_at=agent.created_at,
    )


@router.get("/realtime-options", response_model=RealtimeOptionsOut)
def realtime_options(_admin: User = Depends(current_admin)):
    return RealtimeOptionsOut(
        provider=REALTIME_PROVIDER,
        models=REALTIME_MODELS,
        voices=REALTIME_VOICES,
    )


@router.get("/character-packs", response_model=list[CharacterPackOut])
def character_packs(_admin: User = Depends(current_admin)):
    return [
        CharacterPackOut(id=pack, label=pack.replace("_", " ").title())
        for pack in list_packs()
    ]


@router.get("/stats", response_model=AdminStatsOut)
def admin_stats(
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    start = month_start()
    users_count = int(db.query(func.count(User.id)).scalar() or 0)
    agents_count = int(db.query(func.count(Agent.id)).scalar() or 0)
    usage = db.query(func.coalesce(func.sum(UsageEvent.minutes), 0)).filter(
        UsageEvent.created_at >= start
    ).scalar()
    ai = (
        db.query(
            func.coalesce(func.sum(AiUsageEvent.input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.cost_usd), 0),
            func.count(AiUsageEvent.id),
        )
        .filter(AiUsageEvent.created_at >= start)
        .one()
    )
    return AdminStatsOut(
        users_count=users_count,
        agents_count=agents_count,
        usage_minutes_month=round(float(usage or 0), 2),
        model=settings.openai_realtime_model,
        input_tokens_month=int(ai[0] or 0),
        output_tokens_month=int(ai[1] or 0),
        audio_input_tokens_month=int(ai[2] or 0),
        audio_output_tokens_month=int(ai[3] or 0),
        cost_usd_month=round(float(ai[4] or 0), 4),
        calls_month=int(ai[5] or 0),
    )


@router.get("/openai-costs", response_model=OpenAiOrgCostsOut)
def openai_org_costs(_admin: User = Depends(current_admin)):
    """Actual OpenAI organization spend this month (Costs API, not estimates)."""
    data = fetch_openai_org_costs_month()
    return OpenAiOrgCostsOut(
        ok=bool(data.get("ok")),
        cost_usd=float(data.get("cost_usd") or 0),
        currency=str(data.get("currency") or "usd"),
        line_items=data.get("line_items") or [],
        period_start=data.get("period_start"),
        period_end=data.get("period_end"),
        error=data.get("error"),
    )


@router.get("/usage/summary", response_model=list[AdminUsageSummaryOut])
def usage_summary(
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
    q: str = "",
):
    start = month_start()
    query = (
        db.query(
            AiUsageEvent.user_id,
            User.email,
            func.count(AiUsageEvent.id),
            func.coalesce(func.sum(AiUsageEvent.minutes), 0),
            func.coalesce(func.sum(AiUsageEvent.input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.cost_usd), 0),
        )
        .outerjoin(User, AiUsageEvent.user_id == User.id)
        .filter(AiUsageEvent.created_at >= start)
    )
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(User.email.ilike(like))
    rows = (
        query.group_by(AiUsageEvent.user_id, User.email)
        .order_by(func.sum(AiUsageEvent.cost_usd).desc())
        .all()
    )
    return [
        AdminUsageSummaryOut(
            user_id=int(user_id or 0),
            user_email=email or "",
            calls=int(calls or 0),
            minutes=round(float(minutes or 0), 2),
            input_tokens=int(input_tokens or 0),
            output_tokens=int(output_tokens or 0),
            audio_input_tokens=int(audio_input_tokens or 0),
            audio_output_tokens=int(audio_output_tokens or 0),
            cost_usd=round(float(cost_usd or 0), 4),
        )
        for (
            user_id,
            email,
            calls,
            minutes,
            input_tokens,
            output_tokens,
            audio_input_tokens,
            audio_output_tokens,
            cost_usd,
        ) in rows
    ]


@router.get("/usage", response_model=list[AdminUsageOut])
def list_usage(
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
    limit: int = 100,
    q: str = "",
):
    limit = max(1, min(limit, 500))
    query = (
        db.query(AiUsageEvent, Agent.name, User.email)
        .outerjoin(Agent, AiUsageEvent.agent_id == Agent.id)
        .outerjoin(User, AiUsageEvent.user_id == User.id)
    )
    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        query = query.filter(
            or_(
                User.email.ilike(like),
                Agent.name.ilike(like),
                AiUsageEvent.room_name.ilike(like),
            )
        )
    rows = query.order_by(AiUsageEvent.created_at.desc()).limit(limit).all()
    out: list[AdminUsageOut] = []
    for event, agent_name, email in rows:
        out.append(
            AdminUsageOut(
                id=event.id,
                created_at=event.created_at,
                user_email=email or "",
                agent_name=agent_name or f"#{event.agent_id}",
                agent_id=event.agent_id,
                room_name=event.room_name or "",
                model=event.model or "",
                input_tokens=event.input_tokens or 0,
                output_tokens=event.output_tokens or 0,
                audio_input_tokens=event.audio_input_tokens or 0,
                audio_output_tokens=event.audio_output_tokens or 0,
                minutes=float(event.minutes or 0),
                cost_usd=float(event.cost_usd or 0),
            )
        )
    return out


@router.get("/users", response_model=list[AdminUserOut])
def list_users(
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_out(db, user) for user in users]


@router.patch("/users/{user_id}", response_model=AdminUserOut)
def update_user(
    user_id: int,
    body: AdminUserUpdate,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.email is not None:
        email = body.email.lower()
        clash = db.query(User).filter(User.email == email, User.id != user.id).first()
        if clash:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = email
    if body.password is not None:
        user.password_hash = hash_secret(body.password)
    if body.plan_minutes is not None:
        user.plan_minutes = body.plan_minutes
    if body.is_admin is not None:
        if user.id == admin.id and body.is_admin is False:
            raise HTTPException(status_code=400, detail="Cannot remove your own admin access")
        user.is_admin = body.is_admin
    db.commit()
    db.refresh(user)
    return _user_out(db, user)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    agents = db.query(Agent).filter(Agent.user_id == user.id).all()
    for agent in agents:
        _purge_agent(db, agent)
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.get("/agents", response_model=list[AdminAgentOut])
def list_agents(
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(Agent, User.email)
        .join(User, Agent.user_id == User.id)
        .order_by(Agent.created_at.desc())
        .all()
    )
    return [
        _agent_out(agent, email)
        for agent, email in rows
    ]


@router.patch("/agents/{agent_id}", response_model=AdminAgentOut)
def update_agent(
    agent_id: int,
    body: AdminAgentUpdate,
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    if body.name is not None:
        agent.name = body.name
    if body.voice is not None:
        if not is_valid_voice(body.voice):
            raise HTTPException(status_code=400, detail="Invalid voice")
        agent.voice = body.voice.strip()
    if body.realtime_model is not None:
        if not is_valid_model(body.realtime_model):
            raise HTTPException(status_code=400, detail="Invalid realtime model")
        agent.realtime_model = body.realtime_model.strip()
    if body.character_enabled is not None:
        agent.character_enabled = body.character_enabled
    if body.character_pack is not None:
        pack = body.character_pack.strip()
        if pack and pack not in list_packs():
            raise HTTPException(status_code=400, detail="Unknown character pack")
        agent.character_pack = pack or "character_emoji"
    db.commit()
    db.refresh(agent)
    owner = db.get(User, agent.user_id)
    return _agent_out(agent, owner.email if owner else "")


@router.delete("/agents/{agent_id}")
def delete_agent(
    agent_id: int,
    _admin: User = Depends(current_admin),
    db: Session = Depends(get_db),
):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    _purge_agent(db, agent)
    db.commit()
    return {"ok": True}

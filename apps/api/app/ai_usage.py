from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import estimate_ai_cost_usd, settings
from app.models import Agent, AiUsageEvent, UsageEvent
from app.usage import month_start


def estimate_tokens_from_minutes(minutes: float) -> tuple[int, int]:
    """Rough realtime audio token proxy when OpenAI metrics are missing."""
    approx = max(0, int(float(minutes or 0) * 750))
    return approx, approx


def cost_from_minutes(minutes: float) -> float:
    audio_in, audio_out = estimate_tokens_from_minutes(minutes)
    return estimate_ai_cost_usd(audio_input_tokens=audio_in, audio_output_tokens=audio_out)


def upsert_ai_usage(
    db: Session,
    *,
    agent: Agent,
    room_name: str = "",
    model: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    audio_input_tokens: int = 0,
    audio_output_tokens: int = 0,
    minutes: float = 0,
) -> AiUsageEvent:
    """Create or update an AI usage row for a call (dedupe by room_name within 6h)."""
    model_name = (model or agent.realtime_model or settings.openai_realtime_model or "").strip()
    minutes = max(0.0, float(minutes or 0))
    input_tokens = max(0, int(input_tokens or 0))
    output_tokens = max(0, int(output_tokens or 0))
    audio_input_tokens = max(0, int(audio_input_tokens or 0))
    audio_output_tokens = max(0, int(audio_output_tokens or 0))

    # If no token metrics, estimate from duration so cost still shows on dashboard
    if (
        input_tokens + output_tokens + audio_input_tokens + audio_output_tokens
    ) <= 0 and minutes > 0:
        audio_input_tokens, audio_output_tokens = estimate_tokens_from_minutes(minutes)

    cost = estimate_ai_cost_usd(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        audio_input_tokens=audio_input_tokens,
        audio_output_tokens=audio_output_tokens,
    )
    if cost <= 0 and minutes > 0:
        cost = cost_from_minutes(minutes)

    event = None
    room = (room_name or "").strip()
    if room:
        since = datetime.utcnow() - timedelta(hours=6)
        event = (
            db.query(AiUsageEvent)
            .filter(
                AiUsageEvent.agent_id == agent.id,
                AiUsageEvent.room_name == room,
                AiUsageEvent.created_at >= since,
            )
            .order_by(AiUsageEvent.id.desc())
            .first()
        )

    if event:
        # Prefer richer metrics when agent posts after conversation save
        event.model = model_name or event.model
        event.user_id = agent.user_id
        if minutes > float(event.minutes or 0):
            event.minutes = minutes
        if input_tokens > int(event.input_tokens or 0):
            event.input_tokens = input_tokens
        if output_tokens > int(event.output_tokens or 0):
            event.output_tokens = output_tokens
        if audio_input_tokens > int(event.audio_input_tokens or 0):
            event.audio_input_tokens = audio_input_tokens
        if audio_output_tokens > int(event.audio_output_tokens or 0):
            event.audio_output_tokens = audio_output_tokens
        event.cost_usd = estimate_ai_cost_usd(
            input_tokens=event.input_tokens or 0,
            output_tokens=event.output_tokens or 0,
            audio_input_tokens=event.audio_input_tokens or 0,
            audio_output_tokens=event.audio_output_tokens or 0,
        )
        if float(event.cost_usd or 0) <= 0 and float(event.minutes or 0) > 0:
            event.cost_usd = cost_from_minutes(event.minutes)
        return event

    event = AiUsageEvent(
        agent_id=agent.id,
        user_id=agent.user_id,
        room_name=room,
        model=model_name,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        audio_input_tokens=audio_input_tokens,
        audio_output_tokens=audio_output_tokens,
        minutes=minutes,
        cost_usd=cost,
    )
    db.add(event)
    return event


def backfill_ai_usage_from_plan_minutes(db: Session) -> int:
    """Fill AI usage gaps so dashboard cost matches plan minutes this month."""
    start = month_start()
    created = 0
    agents = db.query(Agent).all()
    for agent in agents:
        plan_minutes = float(
            db.query(func.coalesce(func.sum(UsageEvent.minutes), 0))
            .filter(UsageEvent.agent_id == agent.id, UsageEvent.created_at >= start)
            .scalar()
            or 0
        )
        ai_minutes = float(
            db.query(func.coalesce(func.sum(AiUsageEvent.minutes), 0))
            .filter(AiUsageEvent.agent_id == agent.id, AiUsageEvent.created_at >= start)
            .scalar()
            or 0
        )
        gap = round(plan_minutes - ai_minutes, 4)
        if gap < 0.05:
            continue
        audio_in, audio_out = estimate_tokens_from_minutes(gap)
        db.add(
            AiUsageEvent(
                agent_id=agent.id,
                user_id=agent.user_id,
                room_name="backfill-plan-minutes",
                model=agent.realtime_model or settings.openai_realtime_model,
                input_tokens=0,
                output_tokens=0,
                audio_input_tokens=audio_in,
                audio_output_tokens=audio_out,
                minutes=gap,
                cost_usd=cost_from_minutes(gap),
            )
        )
        created += 1
    if created:
        db.commit()
    return created

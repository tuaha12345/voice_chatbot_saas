from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import current_approved_user, current_user
from app.models import Agent, AiUsageEvent, User
from app.schemas import ModelUsageOut, PasswordChangeIn, UsageOut
from app.security import hash_secret, verify_secret
from app.usage import month_start, usage_minutes_for_user

router = APIRouter(prefix="/v1/me", tags=["me"])


@router.post("/password")
def change_password(
    body: PasswordChangeIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not verify_secret(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_secret(body.new_password)
    db.commit()
    return {"ok": True}


@router.get("/usage", response_model=UsageOut)
def my_usage(user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    used = usage_minutes_for_user(db, user)
    cap = user.plan_minutes if user.plan_minutes is not None else 120
    remaining = max(0.0, float(cap) - used)
    start = month_start()

    agent_ids = [
        row[0] for row in db.query(Agent.id).filter(Agent.user_id == user.id).all()
    ]
    # Match by user_id OR by owned agents (covers older rows with user_id=0)
    owner_filter = AiUsageEvent.user_id == user.id
    if agent_ids:
        owner_filter = or_(owner_filter, AiUsageEvent.agent_id.in_(agent_ids))

    totals = (
        db.query(
            func.count(AiUsageEvent.id),
            func.coalesce(func.sum(AiUsageEvent.cost_usd), 0),
            func.coalesce(func.sum(AiUsageEvent.input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_output_tokens), 0),
        )
        .filter(owner_filter, AiUsageEvent.created_at >= start)
        .one()
    )

    model_rows = (
        db.query(
            AiUsageEvent.model,
            func.count(AiUsageEvent.id),
            func.coalesce(func.sum(AiUsageEvent.minutes), 0),
            func.coalesce(func.sum(AiUsageEvent.input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_input_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.audio_output_tokens), 0),
            func.coalesce(func.sum(AiUsageEvent.cost_usd), 0),
        )
        .filter(owner_filter, AiUsageEvent.created_at >= start)
        .group_by(AiUsageEvent.model)
        .order_by(func.sum(AiUsageEvent.cost_usd).desc())
        .all()
    )

    by_model = [
        ModelUsageOut(
            model=(model or "unknown").strip() or "unknown",
            calls=int(calls or 0),
            minutes=round(float(minutes or 0), 2),
            input_tokens=int(input_tokens or 0),
            output_tokens=int(output_tokens or 0),
            audio_input_tokens=int(audio_input_tokens or 0),
            audio_output_tokens=int(audio_output_tokens or 0),
            cost_usd=round(float(cost_usd or 0), 4),
        )
        for (
            model,
            calls,
            minutes,
            input_tokens,
            output_tokens,
            audio_input_tokens,
            audio_output_tokens,
            cost_usd,
        ) in model_rows
    ]

    return UsageOut(
        used_minutes=round(used, 2),
        plan_minutes=cap,
        remaining_minutes=round(remaining, 2),
        calls_month=int(totals[0] or 0),
        cost_usd_month=round(float(totals[1] or 0), 4),
        input_tokens_month=int(totals[2] or 0),
        output_tokens_month=int(totals[3] or 0),
        audio_input_tokens_month=int(totals[4] or 0),
        audio_output_tokens_month=int(totals[5] or 0),
        by_model=by_model,
    )

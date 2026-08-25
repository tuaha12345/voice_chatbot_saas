from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_agent_secret
from app.config import settings
from app.ai_usage import upsert_ai_usage
from app.models import Agent, Conversation, KnowledgeDoc, Message, UsageEvent
from app.schemas import AiUsageIn, ConversationSaveIn
from app.site_pages import parse_site_pages

router = APIRouter(prefix="/v1/internal", tags=["internal"], dependencies=[Depends(require_agent_secret)])


@router.get("/agents/{agent_id}/context")
def agent_context(agent_id: int, db: Session = Depends(get_db)):
    agent = (
        db.query(Agent)
        .options(joinedload(Agent.modules), joinedload(Agent.knowledge_docs))
        .filter(Agent.id == agent_id)
        .first()
    )
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    docs = (
        db.query(KnowledgeDoc)
        .filter(KnowledgeDoc.agent_id == agent_id)
        .order_by(KnowledgeDoc.id.asc())
        .limit(40)
        .all()
    )
    knowledge = "\n\n".join(f"### {d.title}\n{d.body}" for d in docs)
    if len(knowledge) > 12000:
        knowledge = knowledge[:12000]
    modules = agent.modules
    return {
        "id": agent.id,
        "name": agent.name,
        "language": agent.language,
        "voice": agent.voice,
        "realtime_model": agent.realtime_model or settings.openai_realtime_model,
        "system_prompt": agent.system_prompt,
        "knowledge": knowledge,
        "modules": {
            "qa": bool(modules.qa) if modules else True,
            "support": bool(modules.support) if modules else False,
            "booking": bool(modules.booking) if modules else False,
            "orders": bool(modules.orders) if modules else False,
        },
        "site_pages": parse_site_pages(getattr(agent, "site_pages", None)),
    }


@router.get("/agents/{agent_id}/knowledge/search")
def search_knowledge(agent_id: int, q: str = "", db: Session = Depends(get_db)):
    query = db.query(KnowledgeDoc).filter(KnowledgeDoc.agent_id == agent_id)
    if q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(KnowledgeDoc.title.like(like), KnowledgeDoc.body.like(like)))
    docs = query.order_by(KnowledgeDoc.id.desc()).limit(10).all()
    return [{"id": d.id, "title": d.title, "body": d.body} for d in docs]


@router.post("/agents/{agent_id}/conversations")
def save_conversation(agent_id: int, body: ConversationSaveIn, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    convo = Conversation(
        agent_id=agent_id,
        room_name=body.room_name,
        visitor_identity=body.visitor_identity,
    )
    db.add(convo)
    db.flush()
    for item in body.messages:
        role = str(item.get("role") or "user")
        content = str(item.get("content") or "").strip()
        if not content:
            continue
        db.add(Message(conversation_id=convo.id, role=role, content=content))
    minutes = float(body.minutes or 0)
    if minutes <= 0 and body.messages:
        minutes = max(0.5, round(len(body.messages) * 0.15, 2))
    if minutes:
        db.add(UsageEvent(agent_id=agent_id, minutes=minutes))
        # Always record AI cost/tokens estimate with the call so dashboard never stays at $0
        upsert_ai_usage(
            db,
            agent=agent,
            room_name=body.room_name or "",
            model=agent.realtime_model or settings.openai_realtime_model,
            minutes=minutes,
        )
    db.commit()
    return {"ok": True, "conversation_id": convo.id}


@router.post("/agents/{agent_id}/ai-usage")
def save_ai_usage(agent_id: int, body: AiUsageIn, db: Session = Depends(get_db)):
    agent = db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    event = upsert_ai_usage(
        db,
        agent=agent,
        room_name=body.room_name or "",
        model=body.model or agent.realtime_model or settings.openai_realtime_model,
        input_tokens=body.input_tokens,
        output_tokens=body.output_tokens,
        audio_input_tokens=body.audio_input_tokens,
        audio_output_tokens=body.audio_output_tokens,
        minutes=body.minutes,
    )
    db.commit()
    db.refresh(event)
    return {"ok": True, "id": event.id, "cost_usd": event.cost_usd}

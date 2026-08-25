from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.access import owned_agent
from app.database import get_db
from app.deps import current_user
from app.models import Conversation, User
from app.schemas import ConversationOut

router = APIRouter(prefix="/v1/agents/{agent_id}/conversations", tags=["conversations"])


@router.get("", response_model=list[ConversationOut])
def list_conversations(
    agent_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    return (
        db.query(Conversation)
        .options(joinedload(Conversation.messages))
        .filter(Conversation.agent_id == agent_id)
        .order_by(Conversation.id.desc())
        .limit(50)
        .all()
    )


@router.get("/{conversation_id}", response_model=ConversationOut)
def get_conversation(
    agent_id: int,
    conversation_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = (
        db.query(Conversation)
        .options(joinedload(Conversation.messages))
        .filter(Conversation.id == conversation_id, Conversation.agent_id == agent_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return row

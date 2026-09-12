from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.access import owned_agent
from app.database import get_db
from app.deps import current_approved_user
from app.knowledge_extract import (
    KnowledgeExtractError,
    default_title_from_filename,
    extract_knowledge_text,
)
from app.models import KnowledgeDoc, User
from app.schemas import KnowledgeIn, KnowledgeOut

router = APIRouter(prefix="/v1/agents/{agent_id}/knowledge", tags=["knowledge"])


@router.get("", response_model=list[KnowledgeOut])
def list_docs(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    return (
        db.query(KnowledgeDoc)
        .filter(KnowledgeDoc.agent_id == agent_id)
        .order_by(KnowledgeDoc.id.desc())
        .all()
    )


@router.post("", response_model=KnowledgeOut)
def create_doc(
    agent_id: int,
    body: KnowledgeIn,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    doc = KnowledgeDoc(agent_id=agent_id, title=body.title, body=body.body)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/upload", response_model=KnowledgeOut)
async def upload_doc(
    agent_id: int,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    data = await file.read()
    try:
        body = extract_knowledge_text(
            data,
            filename=file.filename,
            content_type=file.content_type,
        )
    except KnowledgeExtractError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    resolved_title = (title or "").strip() or default_title_from_filename(file.filename)
    resolved_title = resolved_title[:255]
    doc = KnowledgeDoc(agent_id=agent_id, title=resolved_title, body=body)
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
def delete_doc(
    agent_id: int,
    doc_id: int,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    doc = (
        db.query(KnowledgeDoc)
        .filter(KnowledgeDoc.id == doc_id, KnowledgeDoc.agent_id == agent_id)
        .first()
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(doc)
    db.commit()
    return {"ok": True}

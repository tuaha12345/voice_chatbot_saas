from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.access import get_agent_or_404, owned_agent, require_module
from app.database import get_db
from app.deps import current_user, require_agent_secret
from app.models import Ticket, User
from app.notify import notify_event
from app.schemas import TicketCreate, TicketOut, TicketStatusIn

dash = APIRouter(prefix="/v1/agents/{agent_id}/tickets", tags=["tickets"])
internal = APIRouter(
    prefix="/v1/internal/agents/{agent_id}/tickets",
    tags=["internal-tickets"],
    dependencies=[Depends(require_agent_secret)],
)


def _create(db: Session, agent_id: int, body: TicketCreate) -> Ticket:
    agent = get_agent_or_404(db, agent_id)
    require_module(agent, "support")
    row = Ticket(
        agent_id=agent_id,
        visitor_name=body.visitor_name.strip(),
        phone=body.phone.strip(),
        email=body.email.strip(),
        subject=body.subject.strip(),
        body=body.body.strip(),
        status="open",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    notify_event(
        db,
        agent_id,
        "ticket.created",
        {
            "id": row.id,
            "visitor_name": row.visitor_name,
            "phone": row.phone,
            "email": row.email,
            "subject": row.subject,
            "body": row.body,
        },
    )
    return row


@dash.get("", response_model=list[TicketOut])
def list_tickets(agent_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    return (
        db.query(Ticket)
        .filter(Ticket.agent_id == agent_id)
        .order_by(Ticket.id.desc())
        .limit(100)
        .all()
    )


@dash.post("", response_model=TicketOut)
def create_ticket_dash(
    agent_id: int,
    body: TicketCreate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    return _create(db, agent_id, body)


@dash.patch("/{ticket_id}", response_model=TicketOut)
def patch_ticket(
    agent_id: int,
    ticket_id: int,
    body: TicketStatusIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = db.query(Ticket).filter(Ticket.id == ticket_id, Ticket.agent_id == agent_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Ticket not found")
    row.status = body.status
    db.commit()
    db.refresh(row)
    return row


@internal.post("", response_model=TicketOut)
def internal_create(agent_id: int, body: TicketCreate, db: Session = Depends(get_db)):
    return _create(db, agent_id, body)

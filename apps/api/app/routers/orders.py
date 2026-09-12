from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.access import get_agent_or_404, owned_agent, require_module
from app.database import get_db
from app.deps import current_approved_user, require_agent_secret
from app.models import Order, User
from app.notify import notify_event
from app.schemas import OrderCreate, OrderOut, OrderStatusIn

dash = APIRouter(prefix="/v1/agents/{agent_id}/orders", tags=["orders"])
internal = APIRouter(
    prefix="/v1/internal/agents/{agent_id}/orders",
    tags=["internal-orders"],
    dependencies=[Depends(require_agent_secret)],
)


def _create(db: Session, agent_id: int, body: OrderCreate) -> Order:
    agent = get_agent_or_404(db, agent_id)
    require_module(agent, "orders")
    row = Order(
        agent_id=agent_id,
        customer_name=body.customer_name.strip(),
        phone=body.phone.strip(),
        address=body.address.strip(),
        items=body.items.strip(),
        notes=body.notes.strip(),
        status="new",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    notify_event(
        db,
        agent_id,
        "order.created",
        {
            "id": row.id,
            "customer_name": row.customer_name,
            "phone": row.phone,
            "address": row.address,
            "items": row.items,
        },
    )
    return row


@dash.get("", response_model=list[OrderOut])
def list_orders(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    return (
        db.query(Order)
        .filter(Order.agent_id == agent_id)
        .order_by(Order.id.desc())
        .limit(100)
        .all()
    )


@dash.post("", response_model=OrderOut)
def create_order_dash(
    agent_id: int,
    body: OrderCreate,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    return _create(db, agent_id, body)


@dash.patch("/{order_id}", response_model=OrderOut)
def patch_order(
    agent_id: int,
    order_id: int,
    body: OrderStatusIn,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = db.query(Order).filter(Order.id == order_id, Order.agent_id == agent_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    row.status = body.status
    db.commit()
    db.refresh(row)
    return row


@internal.post("", response_model=OrderOut)
def internal_create(agent_id: int, body: OrderCreate, db: Session = Depends(get_db)):
    return _create(db, agent_id, body)

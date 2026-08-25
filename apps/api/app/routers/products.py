from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.access import get_agent_or_404, owned_agent, require_module
from app.database import get_db
from app.deps import current_user, require_agent_secret
from app.models import Product, User
from app.schemas import ProductIn, ProductOut

dash = APIRouter(prefix="/v1/agents/{agent_id}/products", tags=["products"])
internal = APIRouter(
    prefix="/v1/internal/agents/{agent_id}/products",
    tags=["internal-products"],
    dependencies=[Depends(require_agent_secret)],
)


@dash.get("", response_model=list[ProductOut])
def list_products(agent_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    return (
        db.query(Product)
        .filter(Product.agent_id == agent_id)
        .order_by(Product.id.desc())
        .all()
    )


@dash.post("", response_model=ProductOut)
def create_product(
    agent_id: int,
    body: ProductIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = Product(
        agent_id=agent_id,
        name=body.name.strip(),
        sku=body.sku.strip(),
        price=body.price,
        active=body.active,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@dash.delete("/{product_id}")
def delete_product(
    agent_id: int,
    product_id: int,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = db.query(Product).filter(Product.id == product_id, Product.agent_id == agent_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@internal.get("", response_model=list[ProductOut])
def internal_list(agent_id: int, db: Session = Depends(get_db)):
    agent = get_agent_or_404(db, agent_id)
    require_module(agent, "orders")
    return (
        db.query(Product)
        .filter(Product.agent_id == agent_id, Product.active.is_(True))
        .order_by(Product.name.asc())
        .all()
    )

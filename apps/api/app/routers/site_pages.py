"""Tenant CRUD for voice-navigable site pages."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.access import owned_agent
from app.database import get_db
from app.deps import current_approved_user
from app.models import User
from app.schemas import SitePageOut, SitePagesIn, SitePagesOut
from app.site_pages import dump_site_pages, parse_site_pages, validate_pages

dash = APIRouter(prefix="/v1/agents/{agent_id}/site-pages", tags=["site-pages"])


@dash.get("", response_model=SitePagesOut)
def get_site_pages(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    agent = owned_agent(db, user, agent_id)
    pages = parse_site_pages(getattr(agent, "site_pages", None))
    return SitePagesOut(pages=[SitePageOut(**p) for p in pages])


@dash.put("", response_model=SitePagesOut)
def put_site_pages(
    agent_id: int,
    body: SitePagesIn,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    agent = owned_agent(db, user, agent_id)
    try:
        pages = validate_pages(body.pages or [])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    agent.site_pages = dump_site_pages(pages)
    db.commit()
    db.refresh(agent)
    return SitePagesOut(pages=[SitePageOut(**p) for p in pages])

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.access import get_agent_or_404, owned_agent, require_module
from app.booking_slots import default_settings, list_slots, list_slots_range, overlaps, parse_start
from app.database import get_db
from app.deps import current_approved_user, require_agent_secret
from app.models import Agent, Booking, BookingSettings, User
from app.notify import notify_event
from app.schemas import BookingCreate, BookingOut, BookingSettingsIn, BookingSettingsOut

dash = APIRouter(prefix="/v1/agents/{agent_id}/bookings", tags=["bookings"])
internal = APIRouter(
    prefix="/v1/internal/agents/{agent_id}/booking",
    tags=["internal-booking"],
    dependencies=[Depends(require_agent_secret)],
)


def _get_settings(db: Session, agent_id: int) -> BookingSettings:
    row = db.query(BookingSettings).filter(BookingSettings.agent_id == agent_id).first()
    if not row:
        row = default_settings(agent_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _create_booking(db: Session, agent: Agent, body: BookingCreate) -> Booking:
    require_module(agent, "booking")
    settings = _get_settings(db, agent.id)
    try:
        starts = parse_start(body.starts_at)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    ends = starts + timedelta(minutes=settings.slot_minutes)
    guest_name = body.guest_name.strip()
    existing = (
        db.query(Booking)
        .filter(Booking.agent_id == agent.id, Booking.status == "confirmed")
        .all()
    )
    # Idempotent: same guest + same start already booked → return existing (voice agent may retry)
    for b in existing:
        if b.starts_at == starts and (b.guest_name or "").strip().lower() == guest_name.lower():
            return b
    if any(overlaps(starts, ends, b.starts_at, b.ends_at) for b in existing):
        raise HTTPException(status_code=409, detail="That slot is no longer available")
    row = Booking(
        agent_id=agent.id,
        starts_at=starts,
        ends_at=ends,
        guest_name=guest_name,
        guest_phone=body.guest_phone.strip(),
        guest_email=body.guest_email.strip(),
        notes=body.notes.strip(),
        status="confirmed",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    notify_event(
        db,
        agent.id,
        "booking.created",
        {
            "id": row.id,
            "guest_name": row.guest_name,
            "guest_phone": row.guest_phone,
            "guest_email": row.guest_email,
            "starts_at": str(row.starts_at),
            "ends_at": str(row.ends_at),
        },
        guest_email=row.guest_email,
        guest_subject=f"Booking confirmed with {agent.name}",
        guest_body=(
            f"Hi {row.guest_name},\n\nYour meeting is booked for {row.starts_at} "
            f"to {row.ends_at}.\n"
        ),
    )
    return row


@dash.get("/settings", response_model=BookingSettingsOut)
def get_settings(agent_id: int, user: User = Depends(current_approved_user), db: Session = Depends(get_db)):
    owned_agent(db, user, agent_id)
    return _get_settings(db, agent_id)


@dash.put("/settings", response_model=BookingSettingsOut)
def put_settings(
    agent_id: int,
    body: BookingSettingsIn,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = _get_settings(db, agent_id)
    for key, value in body.model_dump().items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return row


def _parse_day(value: str, label: str = "date"):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{label} must be YYYY-MM-DD") from exc


def _slots_payload(db: Session, agent_id: int, day) -> dict:
    settings = _get_settings(db, agent_id)
    existing = db.query(Booking).filter(Booking.agent_id == agent_id).all()
    slots = list_slots(settings, day, existing)
    payload = {
        "timezone": settings.timezone,
        "slot_minutes": settings.slot_minutes,
        "weekdays": settings.weekdays,
        "max_days_ahead": settings.max_days_ahead,
        "open_hour": settings.open_hour,
        "close_hour": settings.close_hour,
        "slots": slots,
    }
    if not slots:
        payload["message"] = (
            f"No open slots on {day.isoformat()}. "
            f"Only weekdays [{settings.weekdays}] within the next {settings.max_days_ahead} days "
            f"between {settings.open_hour}:00 and {settings.close_hour}:00 ({settings.timezone}) are bookable. "
            "Ask the visitor for another date in that window."
        )
    return payload


def _slots_range_payload(db: Session, agent_id: int, from_day, to_day) -> dict:
    settings = _get_settings(db, agent_id)
    existing = db.query(Booking).filter(Booking.agent_id == agent_id).all()
    slots = list_slots_range(settings, from_day, to_day, existing)
    return {
        "timezone": settings.timezone,
        "slot_minutes": settings.slot_minutes,
        "weekdays": settings.weekdays,
        "max_days_ahead": settings.max_days_ahead,
        "open_hour": settings.open_hour,
        "close_hour": settings.close_hour,
        "slots": slots,
    }


@dash.get("", response_model=list[BookingOut])
def list_bookings(
    agent_id: int,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
    from_date: str | None = Query(None, alias="from", description="YYYY-MM-DD"),
    to_date: str | None = Query(None, alias="to", description="YYYY-MM-DD"),
):
    owned_agent(db, user, agent_id)
    q = db.query(Booking).filter(Booking.agent_id == agent_id)
    if from_date or to_date:
        if from_date:
            start = datetime.combine(_parse_day(from_date, "from"), datetime.min.time())
            q = q.filter(Booking.starts_at >= start)
        if to_date:
            end = datetime.combine(_parse_day(to_date, "to"), datetime.max.time())
            q = q.filter(Booking.starts_at <= end)
        return q.order_by(Booking.starts_at.asc()).all()
    return q.order_by(Booking.starts_at.desc()).limit(100).all()


@dash.get("/slots")
def dash_slots(
    agent_id: int,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
    date: str | None = Query(None, description="YYYY-MM-DD"),
    from_date: str | None = Query(None, alias="from", description="YYYY-MM-DD"),
    to_date: str | None = Query(None, alias="to", description="YYYY-MM-DD"),
):
    agent = owned_agent(db, user, agent_id)
    require_module(agent, "booking")
    if date:
        return _slots_payload(db, agent_id, _parse_day(date))
    if from_date and to_date:
        return _slots_range_payload(
            db, agent_id, _parse_day(from_date, "from"), _parse_day(to_date, "to")
        )
    raise HTTPException(status_code=400, detail="Provide date or from and to")


@dash.post("", response_model=BookingOut)
def create_booking_dash(
    agent_id: int,
    body: BookingCreate,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    agent = owned_agent(db, user, agent_id)
    return _create_booking(db, agent, body)


@dash.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    agent_id: int,
    booking_id: int,
    user: User = Depends(current_approved_user),
    db: Session = Depends(get_db),
):
    owned_agent(db, user, agent_id)
    row = db.query(Booking).filter(Booking.id == booking_id, Booking.agent_id == agent_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Booking not found")
    row.status = "cancelled"
    db.commit()
    db.refresh(row)
    return row


@internal.get("/slots")
def internal_slots(
    agent_id: int,
    date: str = Query(..., description="YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    agent = get_agent_or_404(db, agent_id)
    require_module(agent, "booking")
    day = _parse_day(date)
    return _slots_payload(db, agent_id, day)


@internal.post("", response_model=BookingOut)
def internal_create(agent_id: int, body: BookingCreate, db: Session = Depends(get_db)):
    agent = get_agent_or_404(db, agent_id)
    return _create_booking(db, agent, body)

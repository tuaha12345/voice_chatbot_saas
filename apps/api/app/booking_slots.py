from __future__ import annotations

from datetime import datetime, timedelta, time, date

from app.models import Booking, BookingSettings


def default_settings(agent_id: int) -> BookingSettings:
    return BookingSettings(
        agent_id=agent_id,
        timezone="Asia/Dhaka",
        slot_minutes=30,
        open_hour=9,
        close_hour=17,
        weekdays="1,2,3,4,5",
        max_days_ahead=14,
    )


def parse_start(value: str) -> datetime:
    raw = value.strip().replace("Z", "")
    if "T" in raw:
        return datetime.fromisoformat(raw)
    for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    raise ValueError("Invalid datetime; use YYYY-MM-DDTHH:MM")


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    return a_start < b_end and a_end > b_start


def list_slots(
    settings: BookingSettings,
    day: date,
    existing: list[Booking],
    now: datetime | None = None,
) -> list[dict]:
    now = now or datetime.now()
    allowed = {p.strip() for p in (settings.weekdays or "").split(",") if p.strip()}
    if str(day.isoweekday()) not in allowed:
        return []
    if day > (now.date() + timedelta(days=settings.max_days_ahead)):
        return []
    if day < now.date():
        return []

    open_h = max(0, min(23, settings.open_hour))
    close_h = max(open_h + 1, min(24, settings.close_hour))
    minutes = max(10, settings.slot_minutes)
    start = datetime.combine(day, time(open_h, 0))
    end_day = datetime.combine(day, time(min(close_h, 23), 0 if close_h < 24 else 0))
    if close_h >= 24:
        end_day = datetime.combine(day, time(23, 59))
    else:
        end_day = datetime.combine(day, time(close_h, 0))

    confirmed = [b for b in existing if b.status == "confirmed"]
    out = []
    cur = start
    delta = timedelta(minutes=minutes)
    while cur + delta <= end_day:
        slot_end = cur + delta
        if cur <= now:
            cur += delta
            continue
        busy = any(overlaps(cur, slot_end, b.starts_at, b.ends_at) for b in confirmed)
        if not busy:
            out.append(
                {
                    "starts_at": cur.strftime("%Y-%m-%dT%H:%M"),
                    "ends_at": slot_end.strftime("%Y-%m-%dT%H:%M"),
                }
            )
        cur += delta
    return out


def list_slots_range(
    settings: BookingSettings,
    from_day: date,
    to_day: date,
    existing: list[Booking],
    now: datetime | None = None,
) -> list[dict]:
    if to_day < from_day:
        return []
    out: list[dict] = []
    cur = from_day
    while cur <= to_day:
        out.extend(list_slots(settings, cur, existing, now))
        cur += timedelta(days=1)
    return out

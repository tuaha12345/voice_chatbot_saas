from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app.usage import month_start

log = logging.getLogger(__name__)

OPENAI_COSTS_URL = "https://api.openai.com/v1/organization/costs"


def _admin_key() -> str:
    return (settings.openai_admin_api_key or settings.openai_api_key or "").strip()


def _month_range_unix() -> tuple[int, int]:
    start = month_start().replace(tzinfo=timezone.utc)
    end = datetime.now(timezone.utc)
    return int(start.timestamp()), int(end.timestamp())


def fetch_openai_org_costs_month() -> dict[str, Any]:
    """
    Fetch actual USD spend for the current calendar month from OpenAI Costs API.
    Requires an OpenAI Admin API key (OPENAI_ADMIN_API_KEY).
    """
    key = _admin_key()
    if not key:
        return {
            "ok": False,
            "cost_usd": 0.0,
            "currency": "usd",
            "line_items": [],
            "error": "Set OPENAI_ADMIN_API_KEY in .env (Admin key from platform.openai.com).",
        }

    start_time, end_time = _month_range_unix()
    total = 0.0
    by_line: dict[str, float] = {}
    page: str | None = None

    try:
        with httpx.Client(timeout=30.0) as client:
            while True:
                params: dict[str, Any] = {
                    "start_time": start_time,
                    "end_time": end_time,
                    "bucket_width": "1d",
                    "limit": 31,
                    "group_by": "line_item",
                }
                if page:
                    params["page"] = page
                res = client.get(
                    OPENAI_COSTS_URL,
                    headers={"Authorization": f"Bearer {key}"},
                    params=params,
                )
                if res.status_code >= 400:
                    detail = res.text[:500]
                    try:
                        body = res.json()
                        detail = body.get("error", {}).get("message") or detail
                    except Exception:
                        pass
                    return {
                        "ok": False,
                        "cost_usd": 0.0,
                        "currency": "usd",
                        "line_items": [],
                        "error": f"OpenAI Costs API error ({res.status_code}): {detail}",
                    }
                payload = res.json()
                for bucket in payload.get("data") or []:
                    for row in bucket.get("results") or []:
                        amount = row.get("amount") or {}
                        value = float(amount.get("value") or 0)
                        total += value
                        label = str(row.get("line_item") or "Other")
                        by_line[label] = by_line.get(label, 0.0) + value
                if not payload.get("has_more"):
                    break
                page = payload.get("next_page")
                if not page:
                    break
    except httpx.HTTPError as exc:
        log.exception("openai costs fetch failed")
        return {
            "ok": False,
            "cost_usd": 0.0,
            "currency": "usd",
            "line_items": [],
            "error": f"Could not reach OpenAI: {exc}",
        }

    line_items = [
        {"line_item": name, "cost_usd": round(amount, 6)}
        for name, amount in sorted(by_line.items(), key=lambda x: -x[1])
    ]
    return {
        "ok": True,
        "cost_usd": round(total, 4),
        "currency": "usd",
        "line_items": line_items,
        "period_start": month_start().isoformat(),
        "period_end": datetime.utcnow().isoformat(),
        "error": None,
    }

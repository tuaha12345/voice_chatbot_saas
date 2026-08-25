"""Validate and serialize agent site-page navigation maps."""

from __future__ import annotations

import json
import re
from urllib.parse import urlparse

_KEY_RE = re.compile(r"^[a-z0-9_-]{1,40}$")
_MAX_PAGES = 20


def parse_site_pages(raw: str | None) -> list[dict[str, str]]:
    if not raw or not str(raw).strip():
        return []
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return []
    if not isinstance(data, list):
        return []
    out: list[dict[str, str]] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip().lower()
        label = str(item.get("label") or "").strip()
        path = str(item.get("path") or "").strip()
        if not key or not label or not path:
            continue
        out.append({"key": key, "label": label, "path": path})
    return out


def is_safe_path(path: str) -> bool:
    path = (path or "").strip()
    if not path:
        return False
    lower = path.lower()
    if lower.startswith(("javascript:", "data:", "vbscript:", "file:")):
        return False
    if path.startswith("/"):
        # relative site path (allow hash/query)
        return "://" not in path.split("/", 1)[0]
    parsed = urlparse(path)
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def validate_pages(pages: list) -> list[dict[str, str]]:
    if len(pages) > _MAX_PAGES:
        raise ValueError(f"At most {_MAX_PAGES} pages allowed")
    seen: set[str] = set()
    out: list[dict[str, str]] = []
    for item in pages:
        if hasattr(item, "model_dump"):
            item = item.model_dump()
        key = str(item.get("key") or "").strip().lower()
        label = str(item.get("label") or "").strip()
        path = str(item.get("path") or "").strip()
        if not _KEY_RE.match(key):
            raise ValueError(
                f"Invalid key '{key}' — use lowercase letters, numbers, _ or - (1–40 chars)"
            )
        if key in seen:
            raise ValueError(f"Duplicate key '{key}'")
        if not label or len(label) > 120:
            raise ValueError("Each page needs a label (1–120 chars)")
        if not is_safe_path(path):
            raise ValueError(
                f"Invalid path for '{key}' — use /relative or https:// absolute URL"
            )
        seen.add(key)
        out.append({"key": key, "label": label, "path": path})
    return out


def dump_site_pages(pages: list[dict[str, str]]) -> str:
    return json.dumps(pages, ensure_ascii=False)

from __future__ import annotations

import io
import re
from pathlib import Path

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_BODY_CHARS = 50_000

_ALLOWED_SUFFIXES = {".pdf", ".docx"}


class KnowledgeExtractError(ValueError):
    """Raised when an upload cannot be turned into knowledge text."""


def _normalize_whitespace(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        raise KnowledgeExtractError("PDF support is not installed on the server") from exc
    try:
        reader = PdfReader(io.BytesIO(data))
        parts: list[str] = []
        for page in reader.pages:
            chunk = page.extract_text() or ""
            if chunk.strip():
                parts.append(chunk)
        return "\n\n".join(parts)
    except Exception as exc:
        raise KnowledgeExtractError(f"Could not read PDF: {exc}") from exc


def _extract_docx(data: bytes) -> str:
    try:
        from docx import Document
    except ImportError as exc:
        raise KnowledgeExtractError("DOCX support is not installed on the server") from exc
    try:
        document = Document(io.BytesIO(data))
        parts = [p.text.strip() for p in document.paragraphs if p.text and p.text.strip()]
        return "\n\n".join(parts)
    except Exception as exc:
        raise KnowledgeExtractError(f"Could not read DOCX: {exc}") from exc


def detect_kind(filename: str | None, content_type: str | None = None) -> str:
    name = (filename or "").strip().lower()
    suffix = Path(name).suffix if name else ""
    ctype = (content_type or "").split(";")[0].strip().lower()

    if suffix == ".pdf" or ctype in ("application/pdf",):
        return "pdf"
    if suffix == ".docx" or ctype in (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        return "docx"
    if suffix == ".doc" or ctype in ("application/msword",):
        raise KnowledgeExtractError("Legacy .doc is not supported. Please upload a .docx or PDF file.")
    raise KnowledgeExtractError("Only PDF and DOCX files are supported.")


def default_title_from_filename(filename: str | None) -> str:
    name = Path((filename or "").strip() or "document").name
    stem = Path(name).stem.strip() or "Uploaded document"
    return stem[:255]


def extract_knowledge_text(
    data: bytes,
    *,
    filename: str | None = None,
    content_type: str | None = None,
) -> str:
    if not data:
        raise KnowledgeExtractError("Uploaded file is empty")
    if len(data) > MAX_UPLOAD_BYTES:
        raise KnowledgeExtractError("File is too large (max 5 MB)")

    kind = detect_kind(filename, content_type)
    if kind == "pdf":
        raw = _extract_pdf(data)
    else:
        raw = _extract_docx(data)

    text = _normalize_whitespace(raw)
    if not text:
        raise KnowledgeExtractError("No readable text found in the uploaded file")
    if len(text) > MAX_BODY_CHARS:
        text = text[:MAX_BODY_CHARS].rstrip()
    return text

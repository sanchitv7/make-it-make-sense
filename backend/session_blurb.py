"""One-shot Session title + blurb via cheap Gemini Flash-Lite."""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass

from google import genai
from google.genai import types
from google.genai.errors import ClientError

from prompts import SESSION_TITLE_BLURB_PROMPT

SESSION_BLURB_MODEL = "gemini-3.1-flash-lite"

# Cheap models often ignore "don't start with Fact-Checking"; strip it if they do.
_TITLE_PREFIX_RE = re.compile(
    r"^(?:fact[-\s]?checking|fact[-\s]?check|checking)\s*[:\-–—]?\s*",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class SessionTitleBlurb:
    title: str
    blurb: str


async def generate_session_title_blurb(
    *,
    context_preset: str,
    context_detail: str | None,
    claims: list[dict],
    client: genai.Client | None = None,
) -> SessionTitleBlurb | None:
    """Return title+blurb for claims, or None when there is nothing to generate."""
    if not claims:
        return None

    claim_lines = []
    for claim in claims:
        text = claim.get("claim_text") or ""
        verdict = claim.get("verdict") or "UNVERIFIED"
        claim_lines.append(f"- [{verdict}] {text}")

    detail = context_detail.strip() if context_detail else "(none)"
    prompt = (
        SESSION_TITLE_BLURB_PROMPT.replace("{context_preset}", context_preset)
        .replace("{context_detail}", detail)
        .replace("{claims_block}", "\n".join(claim_lines))
    )

    if client is None:
        client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    try:
        response = await client.aio.models.generate_content(
            model=SESSION_BLURB_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=256,
                response_mime_type="application/json",
            ),
        )
    except ClientError:
        return None

    raw = response.text or ""
    if not raw and response.candidates:
        for candidate in response.candidates:
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        raw += part.text

    return _parse_title_blurb(raw)


def _strip_title_prefix(title: str) -> str:
    """Remove a leading Fact-Checking / Fact Check / Checking label from a title."""
    return _TITLE_PREFIX_RE.sub("", title).strip()


def _parse_title_blurb(raw: str) -> SessionTitleBlurb | None:
    matches = list(re.finditer(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}", raw, re.DOTALL))
    if not matches:
        matches = list(re.finditer(r"\{.*\}", raw, re.DOTALL))
    try:
        data = json.loads(matches[-1].group() if matches else raw)
    except (json.JSONDecodeError, ValueError, IndexError):
        return None

    title = _strip_title_prefix((data.get("title") or "").strip())
    blurb = (data.get("blurb") or "").strip()
    if not title or not blurb:
        return None
    return SessionTitleBlurb(title=title, blurb=blurb)

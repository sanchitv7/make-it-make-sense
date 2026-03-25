import asyncio
import json
import logging
import os
import re

logger = logging.getLogger(__name__)

from google import genai
from google.genai import types
from google.genai.errors import ClientError

from models import FactCheckResponse, Verdict
from prompts import FACT_CHECK_PROMPT
from source_filter import is_blocked_url

POOL_SIZE = 5
_client_pool: asyncio.Queue = asyncio.Queue()


async def init_pool() -> None:
    for _ in range(POOL_SIZE):
        await _client_pool.put(genai.Client(api_key=os.environ["GEMINI_API_KEY"]))


def _first_grounding_url(metadata) -> str | None:
    """Return the first web URI from grounding chunks, if any."""
    if not metadata or not metadata.grounding_chunks:
        return None
    for chunk in metadata.grounding_chunks:
        if chunk.web and chunk.web.uri:
            return chunk.web.uri
    return None


async def fact_check_claim(
    claim_text: str,
    preset: str,
    speaker_info: str | None = None,
) -> FactCheckResponse:
    client = await _client_pool.get()
    try:
        return await _do_fact_check(client, claim_text, preset, speaker_info)
    finally:
        await _client_pool.put(client)


_QUOTA_EXHAUSTED = object()  # sentinel


async def _call_model(client: genai.Client, model: str, prompt: str):
    """Call a single model. Returns the response, or _QUOTA_EXHAUSTED sentinel on 429."""
    try:
        return await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
    except ClientError as e:
        if e.code == 429 or (e.status and "RESOURCE_EXHAUSTED" in e.status):
            logger.warning("Quota exhausted for %s: %s", model, e.message)
            return _QUOTA_EXHAUSTED
        raise


def _parse_response(response, claim_text: str) -> FactCheckResponse:
    """Parse a Gemini generate_content response into a FactCheckResponse."""
    raw = ""
    if response.text:
        raw = response.text
    elif response.candidates:
        for candidate in response.candidates:
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        raw += part.text

    matches = list(re.finditer(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}", raw, re.DOTALL))
    if not matches:
        matches = list(re.finditer(r"\{.*\}", raw, re.DOTALL))
    try:
        result = json.loads(matches[-1].group() if matches else raw)
    except (json.JSONDecodeError, ValueError, IndexError):
        return FactCheckResponse(
            claim_text=claim_text,
            timestamp_seconds=0,
            verdict=Verdict.UNVERIFIED,
            verdict_summary="Failed to parse fact-check response",
        )

    metadata = response.candidates[0].grounding_metadata if response.candidates else None
    source_url = _first_grounding_url(metadata) or result.get("source_url") or ""
    source_name = result.get("source_name")

    credibility = result.get("source_credibility", 0)
    try:
        credibility = int(credibility)
    except (TypeError, ValueError):
        credibility = 0

    if not source_url or is_blocked_url(source_url) or credibility < 3:
        return FactCheckResponse(
            claim_text=claim_text,
            timestamp_seconds=0,
            verdict=Verdict.UNVERIFIED,
            verdict_summary=result.get("verdict_summary", "Could not verify with a credible source"),
        )

    verdict_str = result.get("verdict", "UNVERIFIED").upper()
    try:
        verdict = Verdict(verdict_str)
    except ValueError:
        verdict = Verdict.UNVERIFIED

    return FactCheckResponse(
        claim_text=claim_text,
        timestamp_seconds=0,
        verdict=verdict,
        verdict_summary=result.get("verdict_summary", ""),
        source_name=source_name,
        source_url=source_url,
    )


async def _do_fact_check(
    client: genai.Client,
    claim_text: str,
    preset: str,
    speaker_info: str | None = None,
) -> FactCheckResponse:

    speaker_context = f"Speaker/Context: {speaker_info}" if speaker_info else ""
    prompt = (
        FACT_CHECK_PROMPT
        .replace("{claim_text}", claim_text)
        .replace("{speaker_context}", speaker_context)
    )

    # Fire both models in parallel; prefer 2.5-flash, fall back to 2.0-flash on quota error.
    task_25 = asyncio.create_task(_call_model(client, "gemini-2.5-flash", prompt))
    task_20 = asyncio.create_task(_call_model(client, "gemini-2.0-flash", prompt))

    resp_25 = await task_25
    if resp_25 is not _QUOTA_EXHAUSTED:
        task_20.cancel()
        return _parse_response(resp_25, claim_text)

    logger.info("gemini-2.5-flash quota exhausted, using gemini-2.0-flash result")
    resp_20 = await task_20
    if resp_20 is _QUOTA_EXHAUSTED:
        return FactCheckResponse(
            claim_text=claim_text,
            timestamp_seconds=0,
            verdict=Verdict.UNVERIFIED,
            verdict_summary="Fact-check quota exceeded — please try again later.",
        )
    return _parse_response(resp_20, claim_text)

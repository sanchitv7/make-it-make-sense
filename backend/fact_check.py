import asyncio
import json
import os
import re

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


async def _do_fact_check(
    client: genai.Client,
    claim_text: str,
    preset: str,
    speaker_info: str | None = None,
) -> FactCheckResponse:

    speaker_context = f"Speaker/Context: {speaker_info}" if speaker_info else ""

    # Use replace instead of .format() to avoid KeyError when claim_text contains braces
    prompt = (
        FACT_CHECK_PROMPT
        .replace("{claim_text}", claim_text)
        .replace("{speaker_context}", speaker_context)
    )

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                tools=[types.Tool(google_search=types.GoogleSearch())],
            ),
        )
    except ClientError as e:
        if e.code == 429:
            return FactCheckResponse(
                claim_text=claim_text,
                timestamp_seconds=0,
                verdict=Verdict.UNVERIFIED,
                verdict_summary="Fact-check quota exceeded — please try again later.",
            )
        raise

    # Collect text across all candidates/parts (model may stream multiple turns)
    raw = ""
    if response.text:
        raw = response.text
    elif response.candidates:
        for candidate in response.candidates:
            if candidate.content and candidate.content.parts:
                for part in candidate.content.parts:
                    if hasattr(part, "text") and part.text:
                        raw += part.text

    # Extract JSON object — use the last match to skip any preamble text
    matches = list(re.finditer(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}", raw, re.DOTALL))
    # Fall back to greedy match if structured match fails
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

    # Prefer grounding URL (from Google Search), fall back to model-provided URL
    metadata = response.candidates[0].grounding_metadata if response.candidates else None
    source_url = _first_grounding_url(metadata) or result.get("source_url") or ""
    source_name = result.get("source_name")

    # Check credibility score from the model
    credibility = result.get("source_credibility", 0)
    try:
        credibility = int(credibility)
    except (TypeError, ValueError):
        credibility = 0

    # Reject if no source, blocked domain, or credibility too low
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

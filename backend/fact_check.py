import json
import os

from google import genai
from google.genai import types

from models import FactCheckResponse, Verdict
from prompts import FACT_CHECK_PROMPT
from source_filter import filter_trusted_sources, _is_trusted


def get_genai_client() -> genai.Client:
    return genai.Client(api_key=os.environ["GEMINI_API_KEY"])


def _best_grounding_source(
    metadata,
) -> tuple[str | None, str | None]:
    """
    Returns (source_name, source_url) from grounding chunks.
    Chunks have redirect URIs, so we match the domain from chunk.web.title
    against our trusted list, and use the redirect URI as the link.
    """
    if not metadata or not metadata.grounding_chunks:
        return None, None

    for chunk in metadata.grounding_chunks:
        if not chunk.web:
            continue
        title = chunk.web.title or ""  # e.g. "reuters.com" or "BBC News"
        uri = chunk.web.uri or ""

        # Try to match the title as a domain
        domain = title.lower().strip()
        # Strip page titles like "Reuters | US defense spending"
        domain = domain.split(" ")[0].split("|")[0].strip()
        if domain and _is_trusted(domain):
            return title, uri

    return None, None


async def fact_check_claim(
    claim_text: str,
    preset: str,
    speaker_info: str | None = None,
) -> FactCheckResponse:
    client = get_genai_client()

    speaker_context = f"Speaker/Context: {speaker_info}" if speaker_info else ""

    prompt = FACT_CHECK_PROMPT.format(
        claim_text=claim_text,
        speaker_context=speaker_context,
    )

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite-preview",
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
        ),
    )

    # Parse JSON response
    try:
        result = json.loads(response.text)
    except (json.JSONDecodeError, ValueError):
        return FactCheckResponse(
            claim_text=claim_text,
            timestamp_seconds=0,
            verdict=Verdict.UNVERIFIED,
            verdict_summary="Failed to parse fact-check response",
        )

    # Try grounding chunks first (title-based domain matching)
    metadata = (
        response.candidates[0].grounding_metadata
        if response.candidates
        else None
    )
    source_name, source_url = _best_grounding_source(metadata)

    # Fall back to model-provided source_url
    if not source_url:
        model_url = result.get("source_url", "")
        trusted = filter_trusted_sources([model_url]) if model_url else []
        if trusted:
            source_url = trusted[0]
            source_name = result.get("source_name")

    if not source_url:
        # No trusted source — return UNVERIFIED
        return FactCheckResponse(
            claim_text=claim_text,
            timestamp_seconds=0,
            verdict=Verdict.UNVERIFIED,
            verdict_summary=result.get(
                "verdict_summary", "Could not verify with a trusted source"
            ),
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
        source_name=source_name or result.get("source_name"),
        source_url=source_url,
    )

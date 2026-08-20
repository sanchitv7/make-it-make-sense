"""Past Sessions board card assembly and blurb generation behavior."""

import asyncio
from datetime import UTC, datetime

from session_blurb import generate_session_title_blurb
from session_cards import build_session_cards


def test_build_session_cards_hides_open_and_empty_sessions() -> None:
    now = datetime.now(UTC).isoformat()
    sessions = [
        {
            "id": "open",
            "context_preset": "news",
            "context_detail": None,
            "title": None,
            "blurb": None,
            "started_at": now,
            "ended_at": None,
        },
        {
            "id": "empty",
            "context_preset": "news",
            "context_detail": None,
            "title": None,
            "blurb": None,
            "started_at": now,
            "ended_at": now,
        },
        {
            "id": "done",
            "context_preset": "political",
            "context_detail": "SOTU",
            "title": "Grocery prices",
            "blurb": "Claims about inflation.",
            "started_at": now,
            "ended_at": now,
        },
    ]
    claims_by_session = {
        "done": [
            {"verdict": "TRUE"},
            {"verdict": "FALSE"},
            {"verdict": "TRUE"},
        ],
    }

    cards = build_session_cards(sessions, claims_by_session, limit=100)

    assert len(cards) == 1
    card = cards[0]
    assert card.id == "done"
    assert card.title == "Grocery prices"
    assert card.blurb == "Claims about inflation."
    assert card.claim_count == 3
    assert card.verdict_counts.TRUE == 2
    assert card.verdict_counts.FALSE == 1
    assert card.verdict_counts.MISLEADING == 0
    assert card.verdict_counts.UNVERIFIED == 0


def test_generate_session_title_blurb_skips_empty_claims() -> None:
    result = asyncio.run(
        generate_session_title_blurb(
            context_preset="news",
            context_detail=None,
            claims=[],
        )
    )
    assert result is None


def test_build_session_cards_respects_limit_newest_first() -> None:
    sessions = [
        {
            "id": "older",
            "context_preset": "news",
            "context_detail": None,
            "title": None,
            "blurb": None,
            "started_at": "2026-01-01T00:00:00Z",
            "ended_at": "2026-01-01T01:00:00Z",
        },
        {
            "id": "newer",
            "context_preset": "news",
            "context_detail": None,
            "title": None,
            "blurb": None,
            "started_at": "2026-02-01T00:00:00Z",
            "ended_at": "2026-02-01T01:00:00Z",
        },
    ]
    claims_by_session = {
        "older": [{"verdict": "TRUE"}],
        "newer": [{"verdict": "FALSE"}],
    }

    cards = build_session_cards(sessions, claims_by_session, limit=1)

    assert len(cards) == 1
    assert cards[0].id == "newer"

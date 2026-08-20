"""Assemble Past Sessions board cards from session + claim rows."""

from models import SessionCard, Verdict, VerdictCounts


def build_session_cards(
    sessions: list[dict],
    claims_by_session: dict[str, list[dict]],
    *,
    limit: int = 100,
) -> list[SessionCard]:
    """Return ended sessions that have at least one claim, newest first, capped."""
    ended = [s for s in sessions if s.get("ended_at") is not None]
    ended.sort(key=lambda s: s.get("started_at") or "", reverse=True)

    cards: list[SessionCard] = []
    for session in ended:
        session_id = session["id"]
        claims = claims_by_session.get(session_id, [])
        if not claims:
            continue

        counts = VerdictCounts()
        for claim in claims:
            raw = claim.get("verdict", "UNVERIFIED")
            try:
                verdict = Verdict(raw)
            except ValueError:
                verdict = Verdict.UNVERIFIED
            setattr(counts, verdict.value, getattr(counts, verdict.value) + 1)

        cards.append(
            SessionCard(
                id=session_id,
                title=session.get("title"),
                blurb=session.get("blurb"),
                context_preset=session["context_preset"],
                context_detail=session.get("context_detail"),
                started_at=session["started_at"],
                ended_at=session.get("ended_at"),
                claim_count=len(claims),
                verdict_counts=counts,
            )
        )
        if len(cards) >= limit:
            break

    return cards

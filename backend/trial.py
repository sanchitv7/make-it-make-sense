"""Anonymous listening trial: one Session, 60 seconds of wall-clock time."""

from __future__ import annotations

from datetime import UTC, datetime

TRIAL_DURATION_SECONDS = 60
TRIAL_USED_DETAIL = "trial_used"
TRIAL_EXPIRED_DETAIL = "trial_expired"


def parse_timestamptz(value: datetime | str) -> datetime:
    """Parse a Session `started_at` value into an aware UTC datetime."""
    if isinstance(value, datetime):
        dt = value
    else:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def trial_remaining_seconds(
    started_at: datetime | str,
    *,
    now: datetime | None = None,
) -> float:
    """Seconds left in a trial Session, based on wall clock from `started_at`."""
    start = parse_timestamptz(started_at)
    current = now or datetime.now(UTC)
    if current.tzinfo is None:
        current = current.replace(tzinfo=UTC)
    elapsed = (current.astimezone(UTC) - start).total_seconds()
    return max(0.0, TRIAL_DURATION_SECONDS - elapsed)


def is_trial_used(*, is_anonymous: bool, session_count: int) -> bool:
    """True when an anonymous Account already created a Session."""
    return is_anonymous and session_count > 0

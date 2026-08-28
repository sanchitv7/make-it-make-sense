"""Anonymous trial remaining-time and one-Session gate."""

from datetime import UTC, datetime, timedelta

from trial import (
    TRIAL_DURATION_SECONDS,
    is_trial_used,
    parse_timestamptz,
    trial_remaining_seconds,
)


def test_parse_timestamptz_accepts_z_suffix() -> None:
    dt = parse_timestamptz("2026-08-28T12:00:00Z")
    assert dt.tzinfo is not None
    assert dt.utcoffset() == timedelta(0)


def test_trial_remaining_at_start_is_full_duration() -> None:
    start = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
    left = trial_remaining_seconds(start, now=start)
    assert left == float(TRIAL_DURATION_SECONDS)


def test_trial_remaining_decreases_with_wall_clock() -> None:
    start = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
    now = start + timedelta(seconds=12.5)
    left = trial_remaining_seconds(start, now=now)
    assert left == 17.5


def test_trial_remaining_is_zero_after_duration() -> None:
    start = datetime(2026, 8, 28, 12, 0, tzinfo=UTC)
    now = start + timedelta(seconds=TRIAL_DURATION_SECONDS + 4)
    assert trial_remaining_seconds(start, now=now) == 0.0


def test_trial_used_only_for_anonymous_with_a_session() -> None:
    assert is_trial_used(is_anonymous=True, session_count=1) is True
    assert is_trial_used(is_anonymous=True, session_count=0) is False
    assert is_trial_used(is_anonymous=False, session_count=3) is False

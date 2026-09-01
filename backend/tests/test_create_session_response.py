from datetime import UTC, datetime

from models import CreateSessionResponse


def test_create_session_response_includes_started_at() -> None:
    started = datetime(2026, 9, 1, 12, 0, tzinfo=UTC)
    body = CreateSessionResponse(session_id="sess-1", started_at=started)
    dumped = body.model_dump()
    assert dumped["session_id"] == "sess-1"
    assert dumped["started_at"] == started

import os
from datetime import UTC, datetime

from fastapi import HTTPException, status
from supabase import Client, create_client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def create_session(
    preset: str,
    user_id: str,
    context_detail: str | None = None,
) -> str:
    data: dict = {
        "context_preset": preset,
        "user_id": user_id,
    }
    if context_detail:
        data["context_detail"] = context_detail
    result = get_client().table("sessions").insert(data).execute()
    return result.data[0]["id"]


def _fetch_session_row(session_id: str) -> dict:
    try:
        session = get_client().table("sessions").select("*").eq("id", session_id).single().execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        ) from exc
    return session.data


def assert_session_owner(session_id: str, user_id: str) -> dict:
    """Load a session and ensure it belongs to `user_id`. Raises 403/404."""
    data = _fetch_session_row(session_id)
    owner = data.get("user_id")
    if owner is None or owner != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this session",
        )
    return data


def get_session(session_id: str, *, user_id: str | None = None) -> dict:
    """Load session + claims. When `user_id` is set, enforce ownership in one row fetch."""
    data = (
        assert_session_owner(session_id, user_id)
        if user_id is not None
        else _fetch_session_row(session_id)
    )
    claims = (
        get_client()
        .table("claims")
        .select("*")
        .eq("session_id", session_id)
        .order("timestamp_seconds")
        .execute()
    )
    return {**data, "claims": claims.data}


def end_session(session_id: str) -> None:
    get_client().table("sessions").update({"ended_at": datetime.now(UTC).isoformat()}).eq(
        "id", session_id
    ).execute()


def upsert_claim(claim_data: dict) -> dict:
    result = get_client().table("claims").insert(claim_data).execute()
    return result.data[0]

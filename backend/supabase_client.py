import os
from datetime import datetime, timezone

from fastapi import HTTPException, status
from supabase import create_client, Client

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


def get_session(session_id: str) -> dict:
    session = (
        get_client()
        .table("sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    claims = (
        get_client()
        .table("claims")
        .select("*")
        .eq("session_id", session_id)
        .order("timestamp_seconds")
        .execute()
    )
    return {**session.data, "claims": claims.data}


def assert_session_owner(session_id: str, user_id: str) -> dict:
    """Load a session and ensure it belongs to `user_id`. Raises 403/404."""
    try:
        session = (
            get_client()
            .table("sessions")
            .select("*")
            .eq("id", session_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        ) from exc

    data = session.data
    owner = data.get("user_id")
    if owner is None or owner != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to access this session",
        )
    return data


def end_session(session_id: str) -> None:
    get_client().table("sessions").update(
        {"ended_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", session_id).execute()


def upsert_claim(claim_data: dict) -> dict:
    result = get_client().table("claims").insert(claim_data).execute()
    return result.data[0]

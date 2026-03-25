import os
from datetime import datetime, timezone

from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        _client = create_client(url, key)
    return _client


def create_session(preset: str, context_detail: str | None = None) -> str:
    data = {"context_preset": preset}
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


def end_session(session_id: str) -> None:
    get_client().table("sessions").update(
        {"ended_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", session_id).execute()


def upsert_claim(claim_data: dict) -> dict:
    result = get_client().table("claims").insert(claim_data).execute()
    return result.data[0]

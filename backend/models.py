from pydantic import BaseModel
from enum import Enum
from datetime import datetime


class Verdict(str, Enum):
    TRUE = "TRUE"
    FALSE = "FALSE"
    MISLEADING = "MISLEADING"
    UNVERIFIED = "UNVERIFIED"


class FactCheckRequest(BaseModel):
    claim_text: str
    timestamp_seconds: float
    session_id: str
    preset: str
    speaker_info: str | None = None


class FactCheckResponse(BaseModel):
    claim_text: str
    timestamp_seconds: float
    verdict: Verdict
    verdict_summary: str
    source_name: str | None = None
    source_url: str | None = None


class CreateSessionRequest(BaseModel):
    context_preset: str
    context_detail: str | None = None


class CreateSessionResponse(BaseModel):
    session_id: str


class ClaimDetail(BaseModel):
    id: str
    claim_text: str
    timestamp_seconds: float
    verdict: Verdict
    verdict_summary: str | None = None
    source_name: str | None = None
    source_url: str | None = None
    created_at: datetime


class SessionDetail(BaseModel):
    id: str
    context_preset: str
    context_detail: str | None = None
    started_at: datetime
    ended_at: datetime | None = None
    claims: list[ClaimDetail] = []

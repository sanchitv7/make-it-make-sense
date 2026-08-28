"""Supabase access-token verification for HTTP and WebSocket routes."""

from __future__ import annotations

import base64
import json
from dataclasses import dataclass

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import supabase_client

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    """Verified Auth identity. Anonymous Accounts still have a user id + JWT."""

    user_id: str
    is_anonymous: bool


def _jwt_is_anonymous(token: str) -> bool | None:
    """Read `is_anonymous` from an unverified JWT payload. None if unreadable."""
    try:
        parts = token.split(".")
        if len(parts) < 2:
            return None
        payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    if "is_anonymous" not in payload:
        return None
    return bool(payload["is_anonymous"])


def principal_from_user(user: object, token: str) -> Principal:
    """Build a Principal from a Supabase Auth user object and its access token."""
    user_id = getattr(user, "id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    is_anonymous = bool(getattr(user, "is_anonymous", False))
    jwt_flag = _jwt_is_anonymous(token)
    if jwt_flag is True:
        is_anonymous = True
    return Principal(user_id=str(user_id), is_anonymous=is_anonymous)


def verify_principal(token: str) -> Principal:
    """Validate a Supabase access token via Auth API; return user id + anonymity."""
    try:
        result = supabase_client.get_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user = result.user
    if user is None or not user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    return principal_from_user(user, token)


def verify_access_token(token: str) -> str:
    """Validate a Supabase access token via Auth API; return the user id."""
    return verify_principal(token).user_id


async def require_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> Principal:
    """FastAPI dependency: require a Bearer token and return the Principal."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization",
        )
    return verify_principal(credentials.credentials)


async def require_user(
    principal: Principal = Depends(require_principal),
) -> str:
    """FastAPI dependency: require `Authorization: Bearer <jwt>`."""
    return principal.user_id

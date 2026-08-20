"""Supabase access-token verification for HTTP and WebSocket routes."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import supabase_client

_bearer = HTTPBearer(auto_error=False)


def verify_access_token(token: str) -> str:
    """Validate a Supabase access token via Auth API; return the user id."""
    try:
        result = supabase_client.get_client().auth.get_user(token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc

    user = getattr(result, "user", None)
    user_id = getattr(user, "id", None) if user is not None else None
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    return user_id


async def require_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    """FastAPI dependency: require `Authorization: Bearer <jwt>`."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization",
        )
    return verify_access_token(credentials.credentials)

"""Principal extraction from Auth user objects and JWT claims."""

import base64
import json
from types import SimpleNamespace

from auth import principal_from_user


def _unsigned_token(*, is_anonymous: bool | None) -> str:
    header = base64.urlsafe_b64encode(b'{"alg":"none"}').decode().rstrip("=")
    payload: dict = {"sub": "user-1"}
    if is_anonymous is not None:
        payload["is_anonymous"] = is_anonymous
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    return f"{header}.{body}.sig"


def test_principal_uses_user_is_anonymous() -> None:
    user = SimpleNamespace(id="abc", is_anonymous=True)
    principal = principal_from_user(user, _unsigned_token(is_anonymous=False))
    assert principal.user_id == "abc"
    assert principal.is_anonymous is True


def test_principal_jwt_true_overrides_missing_or_false_user_flag() -> None:
    user = SimpleNamespace(id="abc", is_anonymous=False)
    principal = principal_from_user(user, _unsigned_token(is_anonymous=True))
    assert principal.is_anonymous is True


def test_principal_defaults_to_permanent_when_claim_missing() -> None:
    user = SimpleNamespace(id="abc")
    principal = principal_from_user(user, _unsigned_token(is_anonymous=None))
    assert principal.is_anonymous is False

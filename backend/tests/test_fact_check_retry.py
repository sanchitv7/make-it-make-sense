import asyncio
from types import SimpleNamespace

from google.genai.errors import ServerError

from fact_check import _do_fact_check
from models import Verdict


def _unavailable() -> ServerError:
    return ServerError(
        503,
        {
            "error": {
                "code": 503,
                "message": "This model is currently experiencing high demand.",
                "status": "UNAVAILABLE",
            }
        },
    )


class _FakeModels:
    def __init__(self, outcomes: list[object]) -> None:
        self.outcomes = list(outcomes)
        self.calls = 0

    async def generate_content(self, **_kwargs: object) -> object:
        self.calls += 1
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def _ok_response() -> SimpleNamespace:
    return SimpleNamespace(
        text=(
            '{"verdict":"FALSE","verdict_summary":"The claim is false.",'
            '"source_name":"NASA","source_url":"https://www.nasa.gov/fact",'
            '"source_credibility":5}'
        ),
        candidates=[],
    )


async def _no_sleep(*_a: object, **_k: object) -> None:
    return None


def test_503_is_retried_then_succeeds(monkeypatch) -> None:
    monkeypatch.setattr("fact_check.asyncio.sleep", _no_sleep)
    models = _FakeModels([_unavailable(), _ok_response()])
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    result = asyncio.run(_do_fact_check(client, "The Sun orbits the Earth.", "general"))
    assert models.calls == 2
    assert result.verdict == Verdict.FALSE


def test_exhausted_503_returns_unverified_instead_of_raising(monkeypatch) -> None:
    monkeypatch.setattr("fact_check.asyncio.sleep", _no_sleep)
    models = _FakeModels([_unavailable(), _unavailable(), _unavailable()])
    client = SimpleNamespace(aio=SimpleNamespace(models=models))
    result = asyncio.run(_do_fact_check(client, "The Sun orbits the Earth.", "general"))
    assert models.calls == 3
    assert result.verdict == Verdict.UNVERIFIED
    assert (
        "demand" in result.verdict_summary.lower()
        or "unavailable" in result.verdict_summary.lower()
    )

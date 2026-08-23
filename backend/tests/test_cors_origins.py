"""CORS origin parsing and Vercel preview regex."""

import re

from cors_origins import VERCEL_APP_ORIGIN_REGEX, parse_allowed_origins

_PREVIEW = "https://make-it-make-sense-git-cursor-mo-8a33a5-sanchit-vermas-projects.vercel.app"
_PRODUCTION = "https://make-it-make-sense.vercel.app"
_TEAM = "https://make-it-make-sense-sanchit-vermas-projects.vercel.app"


def test_parse_includes_localhost_and_extra_origins() -> None:
    origins = parse_allowed_origins(f"{_PRODUCTION}, http://localhost:3000")
    assert origins[0] == "http://localhost:3000"
    assert _PRODUCTION in origins
    assert origins.count("http://localhost:3000") == 1


def test_parse_empty_is_localhost_only() -> None:
    assert parse_allowed_origins(None) == ["http://localhost:3000"]
    assert parse_allowed_origins("  ") == ["http://localhost:3000"]


def test_vercel_regex_allows_this_project_hosts() -> None:
    pattern = re.compile(VERCEL_APP_ORIGIN_REGEX)
    assert pattern.fullmatch(_PRODUCTION)
    assert pattern.fullmatch(_TEAM)
    assert pattern.fullmatch(_PREVIEW)


def test_vercel_regex_rejects_other_origins() -> None:
    pattern = re.compile(VERCEL_APP_ORIGIN_REGEX)
    assert pattern.fullmatch("https://evil.vercel.app") is None
    assert pattern.fullmatch("http://make-it-make-sense.vercel.app") is None
    assert pattern.fullmatch("https://make-it-make-sense.vercel.app.evil.com") is None
    assert pattern.fullmatch("https://other-app-sanchit-vermas-projects.vercel.app") is None

"""Unit tests for trusted/blocked source URL filtering."""

from source_filter import is_blocked_url


def test_blocks_social_domains() -> None:
    assert is_blocked_url("https://www.reddit.com/r/news/comments/1")
    assert is_blocked_url("https://twitter.com/someone/status/1")
    assert is_blocked_url("https://x.com/someone/status/1")


def test_allows_news_domains() -> None:
    assert not is_blocked_url("https://www.reuters.com/world/article")
    assert not is_blocked_url("https://www.bbc.com/news/article")
    assert not is_blocked_url("https://www.cdc.gov/something")


def test_invalid_url_is_not_blocked() -> None:
    assert not is_blocked_url("not-a-url")

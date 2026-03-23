from urllib.parse import urlparse

BLOCKED_DOMAINS = {
    "reddit.com",
    "twitter.com",
    "x.com",
    "tiktok.com",
    "facebook.com",
    "instagram.com",
    "threads.net",
    "medium.com",
    "substack.com",
    "quora.com",
    "4chan.org",
    "tumblr.com",
}


def _is_blocked(domain: str) -> bool:
    domain = domain.lower().lstrip("www.")
    return domain in BLOCKED_DOMAINS


def is_blocked_url(url: str) -> bool:
    try:
        domain = urlparse(url).netloc.lower().lstrip("www.")
        return _is_blocked(domain)
    except Exception:
        return False

import re
from urllib.parse import urlparse

TRUSTED_DOMAINS = [
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "bbc.co.uk",
    "theguardian.com",
    "fullfact.org",
    "politifact.com",
    "ons.gov.uk",
    "who.int",
    "factcheck.org",
    "snopes.com",
]

GOV_PATTERN = re.compile(r"\.gov(\.[a-z]{2})?$")


def _is_trusted(domain: str) -> bool:
    domain = domain.lower().lstrip("www.")
    if domain in TRUSTED_DOMAINS:
        return True
    if GOV_PATTERN.search(domain):
        return True
    return False


def filter_trusted_sources(urls: list[str]) -> list[str]:
    trusted = []
    for url in urls:
        try:
            domain = urlparse(url).netloc.lower().lstrip("www.")
            if _is_trusted(domain):
                trusted.append(url)
        except Exception:
            continue
    return trusted


def get_best_trusted_source(urls: list[str]) -> str | None:
    trusted = filter_trusted_sources(urls)
    return trusted[0] if trusted else None

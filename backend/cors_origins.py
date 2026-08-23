"""CORS allowlists for local dev, production, and Vercel preview URLs."""

# Production alias plus git/deployment preview hosts for this Vercel project.
# Example: https://make-it-make-sense-git-cursor-mo-8a33a5-sanchit-vermas-projects.vercel.app
VERCEL_APP_ORIGIN_REGEX = r"https://make-it-make-sense(?:-[a-z0-9]+)*\.vercel\.app"

_DEFAULT_ORIGINS = ("http://localhost:3000",)


def parse_allowed_origins(raw: str | None) -> list[str]:
    """Localhost plus comma-separated ALLOWED_ORIGINS, de-duplicated."""
    origins: list[str] = list(_DEFAULT_ORIGINS)
    if raw:
        origins.extend(origin.strip() for origin in raw.split(",") if origin.strip())

    unique: list[str] = []
    seen: set[str] = set()
    for origin in origins:
        if origin not in seen:
            seen.add(origin)
            unique.append(origin)
    return unique

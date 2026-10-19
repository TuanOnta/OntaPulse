"""Plain data exchanged between the posture adapters and the pure evaluators."""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class CookieInfo:
    """Name and flags of one Set-Cookie header. The cookie value is never kept."""

    name: str
    secure: bool = False
    http_only: bool = False
    same_site: str | None = None
    path: str | None = None
    has_domain: bool = False


@dataclass(frozen=True)
class PostureResponse:
    """First response to one GET. Header names are lowercase; Set-Cookie is not included."""

    url: str
    status_code: int
    headers: Mapping[str, tuple[str, ...]]
    cookies: tuple[CookieInfo, ...]
    elapsed_ms: int

    def header(self, name: str) -> str | None:
        values = self.headers.get(name)

        return values[0] if values else None

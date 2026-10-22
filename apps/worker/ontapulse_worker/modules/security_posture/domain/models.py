"""Plain data exchanged between the posture adapters and the pure evaluators."""

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum


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


@dataclass(frozen=True)
class ProbeResponse:
    """One path probe answer. `body_prefix` (at most 4 KB) is for in-memory matching only."""

    status_code: int
    headers: Mapping[str, tuple[str, ...]]
    cookie_names: tuple[str, ...]
    body_prefix: bytes


class TlsOutcome(StrEnum):
    HANDSHAKE_OK = "handshake_ok"
    CERT_VERIFICATION_FAILED = "cert_verification_failed"
    NO_TLS = "no_tls"


@dataclass(frozen=True)
class TlsObservation:
    """What one TLS handshake revealed. Certificate fields exist only after a verified handshake."""

    outcome: TlsOutcome
    protocol: str | None = None
    subject_cn: str | None = None
    issuer: str | None = None
    not_before: datetime | None = None
    not_after: datetime | None = None
    verify_code: int | None = None
    verify_message: str | None = None
    # OpenSSL reason (for example WRONG_VERSION_NUMBER) when the peer does not speak TLS.
    error_reason: str | None = None

"""Ports implemented by the posture adapters."""

from typing import Protocol

from ontapulse_worker.modules.security_posture.domain.models import PostureResponse, TlsObservation


class PostureConnectionError(Exception):
    """The request could not complete (timeout, refused, TLS failure). The scan continues."""


class TlsConnectionError(Exception):
    """The TCP connection or the handshake could not be attempted or completed (no TLS result)."""


class TlsInspector(Protocol):
    def inspect(self, host: str, port: int) -> TlsObservation:
        """One TLS handshake with certificate verification, and nothing else.

        Raises `ScanExecutionError` when the host is not allowed (unresolvable or non-public)
        and `TlsConnectionError` when no TLS-level result could be obtained.
        """
        ...


class PostureHttpClient(Protocol):
    def fetch(self, url: str) -> PostureResponse:
        """One GET, redirects not followed, body not read.

        Raises `ScanExecutionError` when the target is not allowed (invalid URL, unresolvable
        host, non-public address) and `PostureConnectionError` when the request fails.
        """
        ...

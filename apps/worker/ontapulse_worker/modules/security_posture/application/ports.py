"""Ports implemented by the posture adapters."""

from typing import Protocol

from ontapulse_worker.modules.security_posture.domain.models import PostureResponse


class PostureConnectionError(Exception):
    """The request could not complete (timeout, refused, TLS failure). The scan continues."""


class PostureHttpClient(Protocol):
    def fetch(self, url: str) -> PostureResponse:
        """One GET, redirects not followed, body not read.

        Raises `ScanExecutionError` when the target is not allowed (invalid URL, unresolvable
        host, non-public address) and `PostureConnectionError` when the request fails.
        """
        ...

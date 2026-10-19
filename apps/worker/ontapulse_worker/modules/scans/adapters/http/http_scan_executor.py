"""Synchronous HTTP implementation of the ScanExecutor port."""

import ssl
from collections.abc import Callable
from time import perf_counter

import httpx

from ontapulse_worker.modules.scans.adapters.http.url_security import (
    PublicTargetUrlValidator,
    TargetUrlValidator,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import ScanResult

DEFAULT_CONNECT_TIMEOUT_SECONDS = 5.0
DEFAULT_READ_TIMEOUT_SECONDS = 30.0
DEFAULT_WRITE_TIMEOUT_SECONDS = 5.0
DEFAULT_POOL_TIMEOUT_SECONDS = 5.0

# Fixed, safe messages for a target certificate that does not verify. OpenSSL X509_V_ERR_*
# values: 9 not yet valid, 10 expired, 62 hostname mismatch.
CERTIFICATE_MESSAGES = {
    9: "Certificate is not yet valid",
    10: "Certificate has expired",
    62: "Certificate does not match the host name",
}
CERTIFICATE_NOT_TRUSTED_MESSAGE = "Certificate is not trusted"


def certificate_failure_message(error: BaseException) -> str | None:
    """Return a fixed message when `error` was caused by certificate verification, else None."""
    cause: BaseException | None = error

    for _ in range(8):
        if cause is None:
            return None

        if isinstance(cause, ssl.SSLCertVerificationError):
            return CERTIFICATE_MESSAGES.get(cause.verify_code, CERTIFICATE_NOT_TRUSTED_MESSAGE)

        cause = cause.__cause__ or cause.__context__

    return None


class HttpScanExecutor:
    """Execute an HTTP GET check for one public target."""

    def __init__(
        self,
        client: httpx.Client | None = None,
        *,
        target_validator: TargetUrlValidator | None = None,
        clock: Callable[[], float] = perf_counter,
    ) -> None:
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(
                connect=DEFAULT_CONNECT_TIMEOUT_SECONDS,
                read=DEFAULT_READ_TIMEOUT_SECONDS,
                write=DEFAULT_WRITE_TIMEOUT_SECONDS,
                pool=DEFAULT_POOL_TIMEOUT_SECONDS,
            ),
            follow_redirects=False,
        )

        self._owns_client = client is None
        self._target_validator = target_validator or PublicTargetUrlValidator()
        self._clock = clock

    def execute(self, target_url: str) -> ScanResult:
        self._target_validator.validate(target_url)

        started_at = self._clock()

        try:
            with self._client.stream(
                "GET",
                target_url,
            ) as response:
                status_code = response.status_code

        except httpx.TimeoutException as error:
            raise ScanExecutionError("Scan request timed out") from error

        except httpx.RequestError as error:
            raise ScanExecutionError(
                certificate_failure_message(error) or "Scan target is unavailable"
            ) from error

        response_time_ms = max(
            0,
            round((self._clock() - started_at) * 1_000),
        )

        return ScanResult(
            status_code=status_code,
            response_time_ms=response_time_ms,
        )

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "HttpScanExecutor":
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

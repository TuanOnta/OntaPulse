"""Synchronous HTTP implementation of the ScanExecutor port."""

from collections.abc import Callable
from time import perf_counter

import httpx

from ontapulse_worker.modules.scans.adapters.outbound.http.url_security import (
    PublicTargetUrlValidator,
    TargetUrlValidator,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import ScanResult

DEFAULT_CONNECT_TIMEOUT_SECONDS = 5.0
DEFAULT_READ_TIMEOUT_SECONDS = 10.0
DEFAULT_WRITE_TIMEOUT_SECONDS = 5.0
DEFAULT_POOL_TIMEOUT_SECONDS = 5.0


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
            raise ScanExecutionError("Scan target is unavailable") from error

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

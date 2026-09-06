"""Unit tests for HttpScanExecutor."""

from collections.abc import Callable, Iterator

import httpx
import pytest

from ontapulse_worker.modules.scans.adapters.outbound.http.http_scan_executor import (
    HttpScanExecutor,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import ScanResult


def sequence_clock(*values: float) -> Callable[[], float]:
    readings: Iterator[float] = iter(values)

    return lambda: next(readings)


def test_execute_returns_status_code_and_response_time() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        assert str(request.url) == "https://example.com/health"

        return httpx.Response(status_code=503)

    transport = httpx.MockTransport(respond)

    with httpx.Client(transport=transport) as client:
        executor = HttpScanExecutor(
            client,
            clock=sequence_clock(10.0, 10.1234),
        )

        result = executor.execute(
            "https://example.com/health",
        )

    assert result == ScanResult(
        status_code=503,
        response_time_ms=123,
    )


@pytest.mark.parametrize(
    "target_url",
    [
        "",
        "example.com",
        "ftp://example.com/file",
        "https:///missing-host",
        "https://user:password@example.com",
    ],
)
def test_execute_rejects_invalid_target_url(
    target_url: str,
) -> None:
    transport = httpx.MockTransport(
        lambda _: httpx.Response(status_code=200),
    )

    with httpx.Client(transport=transport) as client:
        executor = HttpScanExecutor(client)

        with pytest.raises(
            ScanExecutionError,
            match="Scan target URL is invalid",
        ):
            executor.execute(target_url)


def test_execute_converts_timeout_to_safe_domain_error() -> None:
    def time_out(
        request: httpx.Request,
    ) -> httpx.Response:
        raise httpx.ReadTimeout(
            "read timed out",
            request=request,
        )

    transport = httpx.MockTransport(time_out)

    with httpx.Client(transport=transport) as client:
        executor = HttpScanExecutor(client)

        with pytest.raises(
            ScanExecutionError,
            match="Scan request timed out",
        ) as captured:
            executor.execute("https://example.com")

    assert isinstance(
        captured.value.__cause__,
        httpx.ReadTimeout,
    )


def test_execute_converts_network_error_to_safe_domain_error() -> None:
    def fail_to_connect(
        request: httpx.Request,
    ) -> httpx.Response:
        raise httpx.ConnectError(
            "connection refused",
            request=request,
        )

    transport = httpx.MockTransport(fail_to_connect)

    with httpx.Client(transport=transport) as client:
        executor = HttpScanExecutor(client)

        with pytest.raises(
            ScanExecutionError,
            match="Scan target is unavailable",
        ) as captured:
            executor.execute("https://example.com")

    assert isinstance(
        captured.value.__cause__,
        httpx.ConnectError,
    )

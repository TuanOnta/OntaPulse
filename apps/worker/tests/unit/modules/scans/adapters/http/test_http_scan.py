"""Unit tests for HttpScanExecutor."""

from collections.abc import Callable, Iterator

import httpx
import pytest

from ontapulse_worker.modules.scans.adapters.http.http_scan_executor import (
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


def test_default_client_timeouts() -> None:
    from ontapulse_worker.modules.scans.adapters.http.http_scan_executor import HttpScanExecutor

    executor = HttpScanExecutor()

    try:
        timeout = executor._client.timeout
        assert (timeout.connect, timeout.read, timeout.write, timeout.pool) == (5.0, 30.0, 5.0, 5.0)
    finally:
        executor.close()


class AllowAllTargets:
    def validate(self, target_url: str) -> None:
        return None


def certificate_error(code: int) -> httpx.ConnectError:
    import ssl

    cause = ssl.SSLCertVerificationError(1, "certificate verify failed")
    cause.verify_code = code
    error = httpx.ConnectError("[SSL: CERTIFICATE_VERIFY_FAILED]")
    error.__cause__ = cause

    return error


@pytest.mark.parametrize(
    ("verify_code", "message"),
    [
        (62, "Certificate does not match the host name"),
        (10, "Certificate has expired"),
        (9, "Certificate is not yet valid"),
        (18, "Certificate is not trusted"),
        (20, "Certificate is not trusted"),
        (0, "Certificate is not trusted"),
    ],
)
def test_certificate_failures_are_reported_with_a_specific_message(
    verify_code: int, message: str
) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        raise certificate_error(verify_code)

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        executor = HttpScanExecutor(client, target_validator=AllowAllTargets())

        with pytest.raises(ScanExecutionError) as error:
            executor.execute("https://example.com")

    assert error.value.safe_message == message


def test_other_connection_errors_keep_the_generic_message() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("connection refused")

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        executor = HttpScanExecutor(client, target_validator=AllowAllTargets())

        with pytest.raises(ScanExecutionError) as error:
            executor.execute("https://example.com")

    assert error.value.safe_message == "Scan target is unavailable"


def test_a_timeout_keeps_its_own_message() -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    with httpx.Client(transport=httpx.MockTransport(respond)) as client:
        executor = HttpScanExecutor(client, target_validator=AllowAllTargets())

        with pytest.raises(ScanExecutionError) as error:
            executor.execute("https://example.com")

    assert error.value.safe_message == "Scan request timed out"

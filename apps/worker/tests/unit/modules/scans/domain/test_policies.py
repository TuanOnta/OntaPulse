from ontapulse_worker.modules.scans.domain.models import FindingSeverity, ScanResult
from ontapulse_worker.modules.scans.domain.policies import evaluate_scan_result


def test_healthy_result_has_no_findings() -> None:
    result = evaluate_scan_result(ScanResult(status_code=200, response_time_ms=100))

    assert result.findings == ()


def test_server_error_creates_high_severity_finding() -> None:
    result = evaluate_scan_result(ScanResult(status_code=500, response_time_ms=100))

    assert len(result.findings) == 1
    assert result.findings[0].code == "HTTP_SERVER_ERROR"
    assert result.findings[0].severity is FindingSeverity.HIGH


def test_client_error_creates_medium_severity_finding() -> None:
    result = evaluate_scan_result(ScanResult(status_code=404, response_time_ms=100))

    assert len(result.findings) == 1
    assert result.findings[0].code == "HTTP_CLIENT_ERROR"
    assert result.findings[0].severity is FindingSeverity.MEDIUM


def test_slow_response_creates_finding() -> None:
    result = evaluate_scan_result(
        ScanResult(status_code=200, response_time_ms=2_500),
        slow_threshold_ms=2_000,
    )

    assert len(result.findings) == 1
    assert result.findings[0].code == "SLOW_RESPONSE"


def test_result_can_have_multiple_findings() -> None:
    result = evaluate_scan_result(
        ScanResult(status_code=500, response_time_ms=2_500),
        slow_threshold_ms=2_000,
    )

    assert {finding.code for finding in result.findings} == {
        "HTTP_SERVER_ERROR",
        "SLOW_RESPONSE",
    }

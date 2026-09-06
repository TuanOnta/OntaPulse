"""Domain policies for evaluating HTTP scan results."""

from dataclasses import replace

from ontapulse_worker.modules.scans.domain.models import (
    FindingSeverity,
    ScanFinding,
    ScanResult,
)

DEFAULT_SLOW_RESPONSE_THRESHOLD_MS = 2_000


def evaluate_scan_result(
    result: ScanResult,
    slow_threshold_ms: int = DEFAULT_SLOW_RESPONSE_THRESHOLD_MS,
) -> ScanResult:
    findings: list[ScanFinding] = []

    if 500 <= result.status_code <= 599:
        findings.append(create_server_error_finding(result.status_code))
    elif 400 <= result.status_code <= 499:
        findings.append(create_client_error_finding(result.status_code))

    if result.response_time_ms >= slow_threshold_ms:
        findings.append(create_slow_response_finding(result.response_time_ms, slow_threshold_ms))

    return replace(result, findings=tuple(findings))


def create_server_error_finding(status_code: int) -> ScanFinding:
    return ScanFinding(
        code="HTTP_SERVER_ERROR",
        title="Target returned a server error",
        severity=FindingSeverity.HIGH,
        description=f"The target returned HTTP status {status_code}.",
        recommendation="Inspect the target service logs and upstream dependencies.",
        evidence={"statusCode": status_code},
    )


def create_client_error_finding(status_code: int) -> ScanFinding:
    return ScanFinding(
        code="HTTP_CLIENT_ERROR",
        title="Target returned a client error",
        severity=FindingSeverity.MEDIUM,
        description=f"The target returned HTTP status {status_code}.",
        recommendation="Verify the monitored URL, authentication, and access rules.",
        evidence={"statusCode": status_code},
    )


def create_slow_response_finding(
    response_time_ms: int,
    threshold_ms: int,
) -> ScanFinding:
    return ScanFinding(
        code="SLOW_RESPONSE",
        title="Target response is slow",
        severity=FindingSeverity.MEDIUM,
        description=f"The target responded in {response_time_ms} ms.",
        recommendation="Inspect application performance and external dependencies.",
        evidence={
            "responseTimeMs": response_time_ms,
            "thresholdMs": threshold_ms,
        },
    )

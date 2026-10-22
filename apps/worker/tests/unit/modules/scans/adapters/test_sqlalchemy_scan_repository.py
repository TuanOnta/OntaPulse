from datetime import UTC, datetime
from unittest.mock import MagicMock, Mock
from uuid import UUID

import pytest

from ontapulse_worker.modules.scans.adapters import sqlalchemy_scan_repository
from ontapulse_worker.modules.scans.domain.errors import (
    PermanentScanJobError,
    ScanJobInProgressError,
    ScanStateConflictError,
)
from ontapulse_worker.modules.scans.domain.models import (
    FindingCategory,
    FindingConfidence,
    FindingSeverity,
    ScanFinding,
    ScanJob,
    ScanResult,
)

SCAN_ID = UUID("f7ad663f-bde8-4dc9-8281-5594d6c73c28")
MONITOR_ID = UUID("3edca2bb-c92c-4ac8-a5ed-75630416f604")
NOW = datetime(2026, 9, 5, 8, 0, tzinfo=UTC)
JOB = ScanJob(scanId=SCAN_ID, monitorId=MONITOR_ID)


def create_repository(*execute_results: Mock):
    session = Mock()
    session.execute.side_effect = execute_results
    sessions = MagicMock()
    sessions.begin.return_value.__enter__.return_value = session
    repository = sqlalchemy_scan_repository.SqlAlchemyScanRepository(sessions, clock=lambda: NOW)
    return repository, session


def query_result(row) -> Mock:
    result = Mock()
    result.mappings.return_value.one_or_none.return_value = row
    return result


def update_result(rowcount: int = 1) -> Mock:
    return Mock(rowcount=rowcount)


def test_claim_marks_a_queued_scan_running_and_returns_current_target() -> None:
    repository, session = create_repository(
        query_result({"status": "QUEUED", "targetUrl": "https://example.com/health"}),
        update_result(),
    )

    claimed_scan = repository.claim(JOB)

    assert claimed_scan is not None
    assert claimed_scan.scan_id == SCAN_ID
    assert claimed_scan.target_url == "https://example.com/health"
    assert session.execute.call_count == 2
    assert session.execute.call_args_list[0].args[1] == {
        "scan_id": SCAN_ID,
        "monitor_id": MONITOR_ID,
    }
    assert session.execute.call_args_list[1].args[1] == {
        "scan_id": SCAN_ID,
        "started_at": NOW,
    }


@pytest.mark.parametrize("status", ["SUCCEEDED", "FAILED"])
def test_claim_treats_a_completed_scan_as_idempotently_handled(status: str) -> None:
    repository, session = create_repository(query_result({"status": status, "targetUrl": "x"}))

    assert repository.claim(JOB) is None
    session.execute.assert_called_once()


def test_claim_rejects_a_missing_or_mismatched_scan_permanently() -> None:
    repository, _ = create_repository(query_result(None))

    with pytest.raises(PermanentScanJobError, match="do not match"):
        repository.claim(JOB)


def test_claim_leaves_an_existing_running_scan_unacknowledged() -> None:
    repository, _ = create_repository(
        query_result({"status": "RUNNING", "targetUrl": "https://example.com"})
    )

    with pytest.raises(ScanJobInProgressError, match="already running"):
        repository.claim(JOB)


def test_succeed_persists_scan_metrics() -> None:
    repository, session = create_repository(update_result())

    repository.succeed(SCAN_ID, ScanResult(status_code=204, response_time_ms=37))

    assert session.execute.call_args.args[1] == {
        "scan_id": SCAN_ID,
        "status_code": 204,
        "response_time_ms": 37,
        "finished_at": NOW,
    }


def test_fail_persists_only_the_safe_message() -> None:
    repository, session = create_repository(update_result())

    repository.fail(SCAN_ID, "Target request timed out")

    assert session.execute.call_args.args[1] == {
        "scan_id": SCAN_ID,
        "error_message": "Target request timed out",
        "finished_at": NOW,
    }


def test_release_returns_an_interrupted_scan_to_the_queue_state() -> None:
    repository, session = create_repository(update_result())

    repository.release(SCAN_ID)

    assert session.execute.call_args.args[1] == {"scan_id": SCAN_ID}


def test_state_update_requires_exactly_one_running_scan() -> None:
    repository, _ = create_repository(update_result(rowcount=0))

    with pytest.raises(ScanStateConflictError, match="changed unexpectedly"):
        repository.succeed(SCAN_ID, ScanResult(status_code=200, response_time_ms=10))


def test_claim_reads_the_scan_kind_and_defaults_to_http_probe() -> None:
    repository, _ = create_repository(
        query_result({"status": "QUEUED", "targetUrl": "https://example.com", "kind": "DNS_WATCH"}),
        update_result(),
    )

    claimed_scan = repository.claim(JOB)

    assert claimed_scan is not None
    assert claimed_scan.kind == "DNS_WATCH"


def test_succeed_inserts_http_probe_findings_without_security_fields() -> None:
    repository, session = create_repository(update_result(), Mock())
    finding = ScanFinding(
        code="SLOW_RESPONSE",
        title="Target response is slow",
        severity=FindingSeverity.MEDIUM,
        description="slow",
        evidence={"responseTimeMs": 2500},
    )

    repository.succeed(
        SCAN_ID, ScanResult(status_code=200, response_time_ms=2500, findings=(finding,))
    )

    params = session.execute.call_args_list[1].args[1][0]
    assert params["code"] == "SLOW_RESPONSE"
    assert params["check_id"] is None
    assert params["category"] is None
    assert params["confidence"] is None
    assert params["evidence"] == '{"responseTimeMs": 2500}'


def test_succeed_persists_catalog_fields_and_bounds_their_evidence() -> None:
    repository, session = create_repository(update_result(), Mock())
    findings = (
        ScanFinding(
            code="SEC_HDR_CSP_MISSING",
            title="t",
            severity=FindingSeverity.MEDIUM,
            description="d",
            evidence={"header": "content-security-policy"},
            check_id="SEC_HDR_CSP_MISSING",
            category=FindingCategory.HEADERS,
            confidence=FindingConfidence.MEDIUM,
        ),
        ScanFinding(
            code="SEC_HDR_CSP_UNSAFE_INLINE",
            title="t",
            severity=FindingSeverity.MEDIUM,
            description="d",
            evidence={"value": "x" * 5000},
            check_id="SEC_HDR_CSP_UNSAFE_INLINE",
        ),
    )

    repository.succeed(SCAN_ID, ScanResult(status_code=200, response_time_ms=5, findings=findings))

    first, second = session.execute.call_args_list[1].args[1]
    assert (first["check_id"], first["category"], first["confidence"]) == (
        "SEC_HDR_CSP_MISSING",
        "HEADERS",
        "MEDIUM",
    )
    assert second["evidence"] == '{"truncated": true}'


def test_succeed_stores_sub_check_results_in_the_same_transaction() -> None:
    from ontapulse_worker.modules.scans.domain.models import SubCheckResult, SubCheckState

    repository, session = create_repository(update_result(), Mock(), Mock())
    finding = ScanFinding(
        code="SEC_HDR_HSTS_MISSING",
        title="t",
        severity=FindingSeverity.MEDIUM,
        description="d",
        check_id="SEC_HDR_HSTS_MISSING",
        category=FindingCategory.HEADERS,
    )

    repository.succeed(
        SCAN_ID,
        ScanResult(
            status_code=None,
            response_time_ms=None,
            findings=(finding,),
            sub_checks=(
                SubCheckResult("headers", SubCheckState.RAN),
                SubCheckResult("redirect", SubCheckState.SKIPPED, "connection_failed"),
            ),
        ),
    )

    metrics, sub_checks, findings = (call.args[1] for call in session.execute.call_args_list)
    assert metrics["status_code"] is None
    assert sub_checks == {
        "scan_id": SCAN_ID,
        "sub_checks": (
            '[{"name": "headers", "state": "ran", "reason": null}, '
            '{"name": "redirect", "state": "skipped", "reason": "connection_failed"}]'
        ),
    }
    assert findings[0]["check_id"] == "SEC_HDR_HSTS_MISSING"
    sessions_used = repository._sessions.begin.call_count
    assert sessions_used == 1


def edge_profile():
    from ontapulse_worker.modules.scans.domain.models import (
        EdgeDetection,
        EdgeLayer,
        EdgeProfile,
        EdgeSignal,
        EdgeSignalType,
    )

    return EdgeProfile(
        detections=(
            EdgeDetection(
                vendor="CLOUDFLARE",
                layer=EdgeLayer.CDN,
                confidence=FindingConfidence.MEDIUM,
                signals=(EdgeSignal(EdgeSignalType.HEADER_NAME, "cf-ray"),),
            ),
        ),
        challenge_observed=True,
    )


def test_succeed_upserts_the_edge_profile_in_the_same_transaction() -> None:
    repository, session = create_repository(update_result(), Mock())

    repository.succeed(
        SCAN_ID,
        ScanResult(status_code=200, response_time_ms=10, edge_profile=edge_profile()),
    )

    metrics, upsert = (call.args[1] for call in session.execute.call_args_list)
    statement = session.execute.call_args_list[1].args[0]
    assert metrics["scan_id"] == SCAN_ID
    assert "ON CONFLICT" in str(statement)
    assert 'WHERE "MonitorEdgeProfile"."observedAt" <= EXCLUDED."observedAt"' in str(statement)
    assert upsert["scan_id"] == SCAN_ID
    assert upsert["challenge_observed"] is True
    assert upsert["observed_at"] == NOW
    assert upsert["detections"] == (
        '[{"vendor": "CLOUDFLARE", "layer": "CDN", "confidence": "MEDIUM", '
        '"signals": [{"type": "HEADER_NAME", "name": "cf-ray"}]}]'
    )
    assert repository._sessions.begin.call_count == 1


def test_succeed_writes_an_empty_profile_as_an_empty_list() -> None:
    from ontapulse_worker.modules.scans.domain.models import EdgeProfile

    repository, session = create_repository(update_result(), Mock())

    repository.succeed(
        SCAN_ID,
        ScanResult(200, 10, edge_profile=EdgeProfile(detections=(), challenge_observed=False)),
    )

    assert session.execute.call_args_list[1].args[1]["detections"] == "[]"


def test_succeed_without_a_profile_does_not_touch_the_edge_table() -> None:
    repository, session = create_repository(update_result())

    repository.succeed(SCAN_ID, ScanResult(status_code=200, response_time_ms=10))

    assert session.execute.call_count == 1


def test_an_oversized_edge_profile_drops_trailing_detections_to_fit() -> None:
    from ontapulse_worker.modules.edge_detection.domain.fingerprints import MAX_EDGE_PROFILE_BYTES
    from ontapulse_worker.modules.scans.domain.models import (
        EdgeDetection,
        EdgeLayer,
        EdgeProfile,
        EdgeSignal,
        EdgeSignalType,
    )

    big = EdgeDetection(
        vendor="VERCEL",
        layer=EdgeLayer.CDN,
        confidence=FindingConfidence.LOW,
        signals=tuple(EdgeSignal(EdgeSignalType.HEADER_NAME, "h" * 1000) for _ in range(4)),
    )
    repository, session = create_repository(update_result(), Mock())

    repository.succeed(SCAN_ID, ScanResult(200, 10, edge_profile=EdgeProfile((big,) * 5)))

    stored = session.execute.call_args_list[1].args[1]["detections"]
    assert len(stored.encode()) <= MAX_EDGE_PROFILE_BYTES
    assert stored.count('"vendor"') < 5


@pytest.mark.parametrize(
    ("column", "expected"),
    [(True, True), (False, False), (None, False)],
)
def test_claim_reads_whether_path_probes_are_enabled_and_acknowledged(column, expected) -> None:
    repository, session = create_repository(
        query_result(
            {
                "status": "QUEUED",
                "targetUrl": "https://example.com",
                "kind": "SECURITY_POSTURE",
                "pathProbesEnabled": column,
            }
        ),
        update_result(),
    )

    claimed_scan = repository.claim(JOB)

    assert claimed_scan is not None
    assert claimed_scan.path_probes_enabled is expected
    statement = str(session.execute.call_args_list[0].args[0])
    # Enabled alone is not enough: an acknowledgment time must be stored (defense in depth).
    assert '"pathProbesEnabled" AND settings."pathProbesAcknowledgedAt" IS NOT NULL' in statement
    assert 'LEFT JOIN "MonitorCheckSettings"' in statement


def test_a_claim_without_the_setting_column_defaults_to_no_probes() -> None:
    repository, _ = create_repository(
        query_result({"status": "QUEUED", "targetUrl": "https://example.com"}),
        update_result(),
    )

    claimed_scan = repository.claim(JOB)

    assert claimed_scan is not None
    assert claimed_scan.path_probes_enabled is False

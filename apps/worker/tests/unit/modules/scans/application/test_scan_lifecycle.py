from unittest.mock import Mock, call
from uuid import UUID

import pytest

from ontapulse_worker.modules.scans.application.scan_lifecycle import ScanLifecycleService
from ontapulse_worker.modules.scans.domain.errors import (
    PermanentScanJobError,
    ScanExecutionError,
)
from ontapulse_worker.modules.scans.domain.models import (
    ClaimedScan,
    ScanJob,
    ScanKind,
    ScanResult,
)

SCAN_ID = UUID("f7ad663f-bde8-4dc9-8281-5594d6c73c28")
MONITOR_ID = UUID("3edca2bb-c92c-4ac8-a5ed-75630416f604")
JOB = ScanJob(scanId=SCAN_ID, monitorId=MONITOR_ID)
CLAIMED_SCAN = ClaimedScan(scan_id=SCAN_ID, target_url="https://example.com/health")


def test_completed_scan_is_handled_without_execution() -> None:
    repository = Mock()
    repository.claim.return_value = None
    executor = Mock()

    ScanLifecycleService(repository, executor).handle(JOB)

    executor.execute.assert_not_called()
    repository.succeed.assert_not_called()
    repository.fail.assert_not_called()


def test_successful_execution_is_persisted() -> None:
    events: list[str] = []
    result = ScanResult(status_code=200, response_time_ms=42)
    repository = Mock()
    repository.claim.return_value = CLAIMED_SCAN
    repository.succeed.side_effect = lambda *_: events.append("persisted")
    executor = Mock()
    executor.execute.side_effect = lambda *_: (events.append("executed"), result)[1]

    ScanLifecycleService(repository, executor).handle(JOB)

    assert events == ["executed", "persisted"]
    executor.execute.assert_called_once_with("https://example.com/health")
    repository.succeed.assert_called_once_with(SCAN_ID, result)


def test_expected_execution_failure_is_persisted_safely() -> None:
    repository = Mock()
    repository.claim.return_value = CLAIMED_SCAN
    executor = Mock()
    executor.execute.side_effect = ScanExecutionError("Target request timed out")

    ScanLifecycleService(repository, executor).handle(JOB)

    repository.fail.assert_called_once_with(SCAN_ID, "Target request timed out")
    repository.release.assert_not_called()


def test_unexpected_execution_failure_releases_the_scan_and_propagates() -> None:
    repository = Mock()
    repository.claim.return_value = CLAIMED_SCAN
    executor = Mock()
    executor.execute.side_effect = RuntimeError("temporary dependency failure")

    with pytest.raises(RuntimeError, match="temporary dependency failure"):
        ScanLifecycleService(repository, executor).handle(JOB)

    assert repository.method_calls == [call.claim(JOB), call.release(SCAN_ID)]
    repository.succeed.assert_not_called()
    repository.fail.assert_not_called()


def test_persistence_failure_releases_claim_for_retry():
    repository, executor = Mock(), Mock()
    repository.claim.return_value = CLAIMED_SCAN
    executor.execute.return_value = ScanResult(200, 12)
    repository.succeed.side_effect = RuntimeError("database unavailable")
    with pytest.raises(RuntimeError, match="database unavailable"):
        ScanLifecycleService(repository, executor).handle(JOB)
    repository.release.assert_called_once_with(SCAN_ID)


def test_scan_events_contain_ids_and_result_without_target_payload(caplog):
    repository, executor = Mock(), Mock()
    repository.claim.return_value = CLAIMED_SCAN
    executor.execute.return_value = ScanResult(200, 12)
    with caplog.at_level("INFO"):
        ScanLifecycleService(repository, executor).handle(JOB)
    assert [r.message for r in caplog.records] == ["scan.claimed", "scan.started", "scan.succeeded"]
    for record in caplog.records:
        assert record.scan_id == str(SCAN_ID)
        assert record.monitor_id == str(MONITOR_ID)
        assert hasattr(record, "status_code") and hasattr(record, "response_time_ms")
        assert "example.com" not in record.message
    assert caplog.records[-1].status_code == 200
    assert caplog.records[-1].response_time_ms == 12


def test_scan_without_a_kind_runs_as_http_probe() -> None:
    assert CLAIMED_SCAN.kind == "HTTP_PROBE"


def test_registered_kind_is_dispatched_to_its_own_executor() -> None:
    repository = Mock()
    repository.claim.return_value = ClaimedScan(
        scan_id=SCAN_ID,
        target_url="https://example.com",
        kind=ScanKind.SECURITY_POSTURE.value,
    )
    http_executor = Mock()
    posture_executor = Mock()
    result = ScanResult(status_code=200, response_time_ms=10)
    posture_executor.execute.return_value = result

    ScanLifecycleService(
        repository,
        http_executor,
        executors={ScanKind.SECURITY_POSTURE: posture_executor},
    ).handle(JOB)

    http_executor.execute.assert_not_called()
    posture_executor.execute.assert_called_once_with("https://example.com")
    repository.succeed.assert_called_once()


@pytest.mark.parametrize("kind", ["SECURITY_POSTURE", "DNS_WATCH", "SOMETHING_NEW"])
def test_unregistered_kind_fails_the_scan_and_is_dead_lettered(kind: str) -> None:
    repository = Mock()
    repository.claim.return_value = ClaimedScan(
        scan_id=SCAN_ID, target_url="https://example.com", kind=kind
    )
    executor = Mock()

    with pytest.raises(PermanentScanJobError):
        ScanLifecycleService(repository, executor).handle(JOB)

    executor.execute.assert_not_called()
    repository.fail.assert_called_once_with(SCAN_ID, "Unsupported scan kind.")
    repository.succeed.assert_not_called()


def test_posture_results_are_persisted_as_returned_without_http_policy() -> None:
    repository = Mock()
    repository.claim.return_value = ClaimedScan(
        scan_id=SCAN_ID,
        target_url="https://example.com",
        kind=ScanKind.SECURITY_POSTURE.value,
    )
    posture_executor = Mock()
    # A 404 or a slow answer would add HTTP_CLIENT_ERROR / SLOW_RESPONSE for an HTTP probe.
    result = ScanResult(status_code=404, response_time_ms=9_999, findings=())
    posture_executor.execute.return_value = result

    ScanLifecycleService(
        repository, Mock(), executors={ScanKind.SECURITY_POSTURE: posture_executor}
    ).handle(JOB)

    repository.succeed.assert_called_once_with(SCAN_ID, result)

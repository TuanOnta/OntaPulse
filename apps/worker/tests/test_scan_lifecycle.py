from unittest.mock import Mock, call
from uuid import UUID

import pytest

from ontapulse_worker.scan_job import ScanJob
from ontapulse_worker.scan_lifecycle import (
    ClaimedScan,
    ScanExecutionError,
    ScanLifecycleService,
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

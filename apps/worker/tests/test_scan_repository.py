from datetime import UTC, datetime
from unittest.mock import MagicMock, Mock
from uuid import UUID

import pytest

from ontapulse_worker.domain.scan import (
    PermanentScanJobError,
    ScanJob,
    ScanJobInProgressError,
    ScanResult,
    ScanStateConflictError,
)
from ontapulse_worker.infrastructure.scan_repository import SqlAlchemyScanRepository

SCAN_ID = UUID("f7ad663f-bde8-4dc9-8281-5594d6c73c28")
MONITOR_ID = UUID("3edca2bb-c92c-4ac8-a5ed-75630416f604")
NOW = datetime(2026, 9, 5, 8, 0, tzinfo=UTC)
JOB = ScanJob(scanId=SCAN_ID, monitorId=MONITOR_ID)


def create_repository(*execute_results: Mock):
    session = Mock()
    session.execute.side_effect = execute_results
    sessions = MagicMock()
    sessions.begin.return_value.__enter__.return_value = session
    repository = SqlAlchemyScanRepository(sessions, clock=lambda: NOW)
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

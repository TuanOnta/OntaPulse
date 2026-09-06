"""SQLAlchemy persistence for scan lifecycle state."""

import json
from collections.abc import Callable
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from ontapulse_worker.modules.scans.domain.errors import (
    PermanentScanJobError,
    ScanJobInProgressError,
    ScanStateConflictError,
)
from ontapulse_worker.modules.scans.domain.models import (
    ClaimedScan,
    ScanFinding,
    ScanJob,
    ScanResult,
)

LOAD_SCAN_FOR_UPDATE = text(
    """
    SELECT scan.id, scan.status, monitor."targetUrl"
    FROM "Scan" AS scan
    INNER JOIN "Monitor" AS monitor ON monitor.id = scan."monitorId"
    WHERE scan.id = :scan_id AND scan."monitorId" = :monitor_id
    FOR UPDATE OF scan
    """
)
MARK_SCAN_RUNNING = text(
    """
    UPDATE "Scan"
    SET status = 'RUNNING', "startedAt" = :started_at
    WHERE id = :scan_id AND status = 'QUEUED'
    """
)
MARK_SCAN_SUCCEEDED = text(
    """
    UPDATE "Scan"
    SET status = 'SUCCEEDED',
        "statusCode" = :status_code,
        "responseTimeMs" = :response_time_ms,
        "errorMessage" = NULL,
        "finishedAt" = :finished_at
    WHERE id = :scan_id AND status = 'RUNNING'
    """
)
MARK_SCAN_FAILED = text(
    """
    UPDATE "Scan"
    SET status = 'FAILED', "errorMessage" = :error_message, "finishedAt" = :finished_at
    WHERE id = :scan_id AND status = 'RUNNING'
    """
)
RELEASE_SCAN = text(
    """
    UPDATE "Scan"
    SET status = 'QUEUED', "startedAt" = NULL
    WHERE id = :scan_id AND status = 'RUNNING'
    """
)
INSERT_SCAN_FINDING = text(
    """
    INSERT INTO "ScanFinding" (
        id,
        "scanId",
        code,
        title,
        severity,
        description,
        recommendation,
        evidence,
        "createdAt"
    )
    VALUES (
        :id,
        :scan_id,
        :code,
        :title,
        :severity,
        :description,
        :recommendation,
        CAST(:evidence AS JSONB),
        :created_at
    )
    """
)


class ScanStatus(StrEnum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    SUCCEEDED = "SUCCEEDED"
    FAILED = "FAILED"


def utc_now() -> datetime:
    return datetime.now(UTC)


class SqlAlchemyScanRepository:
    def __init__(
        self,
        sessions: sessionmaker[Session],
        clock: Callable[[], datetime] = utc_now,
    ) -> None:
        self._sessions = sessions
        self._clock = clock

    def claim(self, job: ScanJob) -> ClaimedScan | None:
        with self._sessions.begin() as session:
            row = (
                session.execute(
                    LOAD_SCAN_FOR_UPDATE,
                    {"scan_id": job.scan_id, "monitor_id": job.monitor_id},
                )
                .mappings()
                .one_or_none()
            )

            if row is None:
                raise PermanentScanJobError("scan and monitor do not match")

            status = ScanStatus(str(row["status"]))

            if status in {ScanStatus.SUCCEEDED, ScanStatus.FAILED}:
                return None

            if status is ScanStatus.RUNNING:
                raise ScanJobInProgressError("scan is already running")

            result = session.execute(
                MARK_SCAN_RUNNING,
                {"scan_id": job.scan_id, "started_at": self._clock()},
            )
            self._require_changed_row(result.rowcount)

            return ClaimedScan(scan_id=job.scan_id, target_url=str(row["targetUrl"]))

    def succeed(self, scan_id: UUID, result: ScanResult) -> None:
        finished_at = self._clock()

        with self._sessions.begin() as session:
            updated = session.execute(
                MARK_SCAN_SUCCEEDED,
                {
                    "scan_id": scan_id,
                    "status_code": result.status_code,
                    "response_time_ms": result.response_time_ms,
                    "finished_at": finished_at,
                },
            )
            self._require_changed_row(updated.rowcount)

            if result.findings:
                session.execute(
                    INSERT_SCAN_FINDING,
                    [
                        self._finding_params(scan_id, finding, finished_at)
                        for finding in result.findings
                    ],
                )

    def fail(self, scan_id: UUID, error_message: str) -> None:
        with self._sessions.begin() as session:
            updated = session.execute(
                MARK_SCAN_FAILED,
                {
                    "scan_id": scan_id,
                    "error_message": error_message,
                    "finished_at": self._clock(),
                },
            )
            self._require_changed_row(updated.rowcount)

    def release(self, scan_id: UUID) -> None:
        with self._sessions.begin() as session:
            updated = session.execute(RELEASE_SCAN, {"scan_id": scan_id})
            self._require_changed_row(updated.rowcount)

    @staticmethod
    def _require_changed_row(rowcount: int) -> None:
        if rowcount != 1:
            raise ScanStateConflictError("scan state changed unexpectedly")

    @staticmethod
    def _finding_params(
        scan_id: UUID,
        finding: ScanFinding,
        created_at: datetime,
    ) -> dict[str, object]:
        evidence = json.dumps(finding.evidence) if finding.evidence is not None else None

        return {
            "id": uuid4(),
            "scan_id": scan_id,
            "code": finding.code,
            "title": finding.title,
            "severity": finding.severity.value,
            "description": finding.description,
            "recommendation": finding.recommendation,
            "evidence": evidence,
            "created_at": created_at,
        }

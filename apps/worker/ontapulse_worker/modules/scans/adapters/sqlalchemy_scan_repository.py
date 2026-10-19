"""SQLAlchemy persistence for scan lifecycle state."""

import json
from collections.abc import Callable
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session, sessionmaker

from ontapulse_worker.modules.edge_detection.domain.fingerprints import MAX_EDGE_PROFILE_BYTES
from ontapulse_worker.modules.scans.domain.errors import (
    PermanentScanJobError,
    ScanJobInProgressError,
    ScanStateConflictError,
)
from ontapulse_worker.modules.scans.domain.models import (
    ClaimedScan,
    EdgeProfile,
    ScanFinding,
    ScanJob,
    ScanKind,
    ScanResult,
)

# Evidence of catalog findings is bounded (docs/security-checks.md section 5). HTTP_PROBE
# findings have no check ID and keep their evidence unchanged.
MAX_EVIDENCE_BYTES = 4096

LOAD_SCAN_FOR_UPDATE = text(
    """
    SELECT scan.id, scan.status, scan.kind, monitor."targetUrl"
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
SET_SCAN_SUB_CHECKS = text(
    """
    UPDATE "Scan"
    SET "subChecks" = CAST(:sub_checks AS JSONB)
    WHERE id = :scan_id AND status = 'SUCCEEDED'
    """
)
# One current profile per monitor; an older scan never overwrites a newer observation. The monitor
# id comes from the scan row, so the lifecycle port needs no new argument.
UPSERT_EDGE_PROFILE = text(
    """
    INSERT INTO "MonitorEdgeProfile" (
        id,
        "monitorId",
        "scanId",
        "challengeObserved",
        detections,
        "observedAt",
        "createdAt",
        "updatedAt"
    )
    SELECT
        :id,
        scan."monitorId",
        scan.id,
        :challenge_observed,
        CAST(:detections AS JSONB),
        :observed_at,
        :observed_at,
        :observed_at
    FROM "Scan" AS scan
    WHERE scan.id = :scan_id
    ON CONFLICT ("monitorId") DO UPDATE
    SET "scanId" = EXCLUDED."scanId",
        "challengeObserved" = EXCLUDED."challengeObserved",
        detections = EXCLUDED.detections,
        "observedAt" = EXCLUDED."observedAt",
        "updatedAt" = EXCLUDED."updatedAt"
    WHERE "MonitorEdgeProfile"."observedAt" <= EXCLUDED."observedAt"
    """
)
INSERT_SCAN_FINDING = text(
    """
    INSERT INTO "ScanFinding" (
        id,
        "scanId",
        code,
        "checkId",
        category,
        confidence,
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
        :check_id,
        CAST(:category AS "FindingCategory"),
        CAST(:confidence AS "FindingConfidence"),
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

            return ClaimedScan(
                scan_id=job.scan_id,
                target_url=str(row["targetUrl"]),
                kind=str(row.get("kind") or ScanKind.HTTP_PROBE.value),
            )

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

            if result.sub_checks:
                session.execute(
                    SET_SCAN_SUB_CHECKS,
                    {
                        "scan_id": scan_id,
                        "sub_checks": json.dumps(
                            [
                                {
                                    "name": item.name,
                                    "state": item.state.value,
                                    "reason": item.reason,
                                }
                                for item in result.sub_checks
                            ]
                        ),
                    },
                )

            if result.edge_profile is not None:
                session.execute(
                    UPSERT_EDGE_PROFILE,
                    self._edge_profile_params(scan_id, result.edge_profile, finished_at),
                )

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
        evidence = SqlAlchemyScanRepository._serialize_evidence(finding)

        return {
            "id": uuid4(),
            "scan_id": scan_id,
            "code": finding.code,
            "check_id": finding.check_id,
            "category": finding.category.value if finding.category else None,
            "confidence": finding.confidence.value if finding.confidence else None,
            "title": finding.title,
            "severity": finding.severity.value,
            "description": finding.description,
            "recommendation": finding.recommendation,
            "evidence": evidence,
            "created_at": created_at,
        }

    @staticmethod
    def _edge_profile_params(
        scan_id: UUID,
        profile: EdgeProfile,
        observed_at: datetime,
    ) -> dict[str, object]:
        return {
            "id": uuid4(),
            "scan_id": scan_id,
            "challenge_observed": profile.challenge_observed,
            "detections": SqlAlchemyScanRepository._serialize_detections(profile),
            "observed_at": observed_at,
        }

    @staticmethod
    def _serialize_detections(profile: EdgeProfile) -> str:
        """Names and levels only, bounded: drop trailing detections until the JSON fits."""
        items = [
            {
                "vendor": detection.vendor,
                "layer": detection.layer.value,
                "confidence": detection.confidence.value,
                "signals": [
                    {"type": signal.type.value, "name": signal.name} for signal in detection.signals
                ],
            }
            for detection in profile.detections
        ]

        while items and len(json.dumps(items).encode()) > MAX_EDGE_PROFILE_BYTES:
            items.pop()

        return json.dumps(items)

    @staticmethod
    def _serialize_evidence(finding: ScanFinding) -> str | None:
        if finding.evidence is None:
            return None

        serialized = json.dumps(finding.evidence)

        if finding.check_id is not None and len(serialized.encode()) > MAX_EVIDENCE_BYTES:
            return json.dumps({"truncated": True})

        return serialized

import logging
from collections.abc import Mapping
from contextlib import suppress

from ontapulse_worker.modules.scans.application.ports import ScanExecutor, ScanLifecycleRepository
from ontapulse_worker.modules.scans.domain.errors import (
    PermanentScanJobError,
    ScanExecutionError,
)
from ontapulse_worker.modules.scans.domain.models import ScanJob, ScanKind
from ontapulse_worker.modules.scans.domain.policies import evaluate_scan_result

logger = logging.getLogger(__name__)

UNSUPPORTED_KIND_MESSAGE = "Unsupported scan kind."


class ScanLifecycleService:
    def __init__(
        self,
        repository: ScanLifecycleRepository,
        executor: ScanExecutor,
        *,
        executors: Mapping[ScanKind, ScanExecutor] | None = None,
    ) -> None:
        """Dispatch claimed scans by kind. `executor` runs HTTP_PROBE; `executors` adds kinds."""
        self._repository = repository
        self._executors: dict[str, ScanExecutor] = {ScanKind.HTTP_PROBE.value: executor}
        self._executors.update({kind.value: item for kind, item in (executors or {}).items()})

    def handle(self, job: ScanJob) -> None:
        fields = {
            "scan_id": str(job.scan_id),
            "monitor_id": str(job.monitor_id),
            "scan_kind": None,
            "status_code": None,
            "response_time_ms": None,
        }
        claimed_scan = self._repository.claim(job)

        if claimed_scan is None:
            logger.info("scan.duplicate_ignored", extra=fields)
            return

        fields["scan_kind"] = claimed_scan.kind
        logger.info("scan.claimed", extra=fields)

        try:
            executor = self._executors.get(claimed_scan.kind)

            if executor is None:
                # A kind with no registered check is a permanent error: close the scan so it
                # does not stay RUNNING, then dead-letter the delivery.
                self._repository.fail(claimed_scan.scan_id, UNSUPPORTED_KIND_MESSAGE)
                logger.error("scan.unsupported_kind", extra=fields)
                raise PermanentScanJobError("unsupported scan kind")

            try:
                logger.info("scan.started", extra=fields)
                raw_result = executor.execute(claimed_scan.target_url)
                result = evaluate_scan_result(raw_result)
                self._repository.succeed(claimed_scan.scan_id, result)
            except ScanExecutionError as error:
                self._repository.fail(claimed_scan.scan_id, error.safe_message)
                logger.warning("scan.failed", extra={**fields, "reason": "execution_failure"})
            else:
                logger.info(
                    "scan.succeeded",
                    extra={
                        **fields,
                        "status_code": result.status_code,
                        "response_time_ms": result.response_time_ms,
                    },
                )
        except Exception:
            # Persistence failures must also release the claim. A committed terminal
            # update is safe: release cannot overwrite it and redelivery is idempotent.
            with suppress(Exception):
                self._repository.release(claimed_scan.scan_id)
            raise

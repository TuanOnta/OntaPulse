import logging
from contextlib import suppress

from ontapulse_worker.modules.scans.application.ports.scan_executor import ScanExecutor
from ontapulse_worker.modules.scans.application.ports.scan_repository import ScanLifecycleRepository
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import ScanJob

logger = logging.getLogger(__name__)


class ScanLifecycleService:
    def __init__(
        self,
        repository: ScanLifecycleRepository,
        executor: ScanExecutor,
    ) -> None:
        self._repository = repository
        self._executor = executor

    def handle(self, job: ScanJob) -> None:
        fields = {
            "scan_id": str(job.scan_id),
            "monitor_id": str(job.monitor_id),
            "status_code": None,
            "response_time_ms": None,
        }
        claimed_scan = self._repository.claim(job)

        if claimed_scan is None:
            logger.info("scan.duplicate_ignored", extra=fields)
            return

        logger.info("scan.claimed", extra=fields)
        logger.info("scan.started", extra=fields)

        try:
            try:
                result = self._executor.execute(claimed_scan.target_url)
            except ScanExecutionError as error:
                self._repository.fail(claimed_scan.scan_id, error.safe_message)
                logger.warning("scan.failed", extra={**fields, "reason": "execution_failure"})
            else:
                self._repository.succeed(claimed_scan.scan_id, result)
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

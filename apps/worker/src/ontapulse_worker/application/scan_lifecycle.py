from typing import Protocol
from uuid import UUID

from ontapulse_worker.domain.scan import ClaimedScan, ScanExecutionError, ScanJob, ScanResult


class ScanLifecycleRepository(Protocol):
    def claim(self, job: ScanJob) -> ClaimedScan | None: ...

    def succeed(self, scan_id: UUID, result: ScanResult) -> None: ...

    def fail(self, scan_id: UUID, error_message: str) -> None: ...

    def release(self, scan_id: UUID) -> None: ...


class ScanExecutor(Protocol):
    def execute(self, target_url: str) -> ScanResult: ...


class ScanLifecycleService:
    def __init__(
        self,
        repository: ScanLifecycleRepository,
        executor: ScanExecutor,
    ) -> None:
        self._repository = repository
        self._executor = executor

    def handle(self, job: ScanJob) -> None:
        claimed_scan = self._repository.claim(job)

        if claimed_scan is None:
            return

        try:
            result = self._executor.execute(claimed_scan.target_url)
        except ScanExecutionError as error:
            self._repository.fail(claimed_scan.scan_id, error.safe_message)
        except Exception:
            self._repository.release(claimed_scan.scan_id)
            raise
        else:
            self._repository.succeed(claimed_scan.scan_id, result)

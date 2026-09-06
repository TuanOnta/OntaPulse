from typing import Protocol
from uuid import UUID

from ontapulse_worker.modules.scans.domain.models import ClaimedScan, ScanJob, ScanResult


class ScanLifecycleRepository(Protocol):
    def claim(self, job: ScanJob) -> ClaimedScan | None: ...

    def succeed(self, scan_id: UUID, result: ScanResult) -> None: ...

    def fail(self, scan_id: UUID, error_message: str) -> None: ...

    def release(self, scan_id: UUID) -> None: ...

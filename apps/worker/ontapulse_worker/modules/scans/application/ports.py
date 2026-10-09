"""Ports implemented by scan adapters."""

from typing import Protocol
from uuid import UUID

from ontapulse_worker.modules.scans.domain.models import ClaimedScan, ScanJob, ScanResult


class ScanExecutor(Protocol):
    def execute(self, target_url: str) -> ScanResult: ...


class ScanLifecycleRepository(Protocol):
    def claim(self, job: ScanJob) -> ClaimedScan | None: ...

    def succeed(self, scan_id: UUID, result: ScanResult) -> None: ...

    def fail(self, scan_id: UUID, error_message: str) -> None: ...

    def release(self, scan_id: UUID) -> None: ...

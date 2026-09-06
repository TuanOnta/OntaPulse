from typing import Protocol

from ontapulse_worker.modules.scans.domain.models import ScanResult


class ScanExecutor(Protocol):
    def execute(self, target_url: str) -> ScanResult: ...

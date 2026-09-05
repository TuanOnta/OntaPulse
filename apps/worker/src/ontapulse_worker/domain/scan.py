from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ScanJob(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    scan_id: UUID = Field(alias="scanId")
    monitor_id: UUID = Field(alias="monitorId")


@dataclass(frozen=True)
class ClaimedScan:
    scan_id: UUID
    target_url: str


@dataclass(frozen=True)
class ScanResult:
    status_code: int
    response_time_ms: int


class ScanExecutionError(Exception):
    def __init__(self, safe_message: str) -> None:
        super().__init__(safe_message)
        self.safe_message = safe_message


class PermanentScanJobError(Exception):
    """Raised when retrying a valid scan job cannot succeed."""


class ScanJobInProgressError(RuntimeError):
    """Raised when another delivery has already claimed the scan."""


class ScanStateConflictError(RuntimeError):
    """Raised when a scan changes state outside the active lifecycle."""

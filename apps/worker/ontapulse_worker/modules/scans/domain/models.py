from dataclasses import dataclass
from enum import StrEnum
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


class FindingSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass(frozen=True)
class ScanFinding:
    code: str
    title: str
    severity: FindingSeverity
    description: str
    recommendation: str | None = None
    evidence: dict[str, object] | None = None


@dataclass(frozen=True)
class ScanResult:
    status_code: int
    response_time_ms: int
    findings: tuple[ScanFinding, ...] = ()

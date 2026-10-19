from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ScanJob(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    scan_id: UUID = Field(alias="scanId")
    monitor_id: UUID = Field(alias="monitorId")


class ScanKind(StrEnum):
    HTTP_PROBE = "HTTP_PROBE"
    SECURITY_POSTURE = "SECURITY_POSTURE"
    DNS_WATCH = "DNS_WATCH"


@dataclass(frozen=True)
class ClaimedScan:
    scan_id: UUID
    target_url: str
    # Kept as text: a kind added by a newer API must not crash an older worker's claim.
    kind: str = ScanKind.HTTP_PROBE.value


class FindingSeverity(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FindingCategory(StrEnum):
    HEADERS = "HEADERS"
    COOKIES = "COOKIES"
    CORS = "CORS"
    REDIRECT = "REDIRECT"
    TLS = "TLS"
    EXPOSED_FILES = "EXPOSED_FILES"
    DNS = "DNS"
    EMAIL_AUTH = "EMAIL_AUTH"


class FindingConfidence(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass(frozen=True)
class ScanFinding:
    code: str
    title: str
    severity: FindingSeverity
    description: str
    recommendation: str | None = None
    evidence: dict[str, object] | None = None
    check_id: str | None = None
    category: FindingCategory | None = None
    confidence: FindingConfidence | None = None


class SubCheckState(StrEnum):
    RAN = "ran"
    SKIPPED = "skipped"


@dataclass(frozen=True)
class SubCheckResult:
    name: str
    state: SubCheckState
    reason: str | None = None


@dataclass(frozen=True)
class ScanResult:
    # None only for kinds whose request never produced a response (see SECURITY_POSTURE).
    status_code: int | None
    response_time_ms: int | None
    findings: tuple[ScanFinding, ...] = ()
    sub_checks: tuple[SubCheckResult, ...] = ()

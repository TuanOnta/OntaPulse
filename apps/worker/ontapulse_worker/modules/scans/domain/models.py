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
    # True only when path probes are enabled for the monitor AND an acknowledgment time is stored.
    path_probes_enabled: bool = False
    monitor_id: UUID | None = None


@dataclass(frozen=True)
class ScanOptions:
    """Per-scan settings read at claim time (the queue payload stays unchanged)."""

    path_probes_enabled: bool = False
    monitor_id: UUID | None = None


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


class EdgeLayer(StrEnum):
    CDN = "CDN"
    WAF = "WAF"
    ANTI_BOT = "ANTI_BOT"


class EdgeSignalType(StrEnum):
    HEADER_NAME = "HEADER_NAME"
    COOKIE_NAME = "COOKIE_NAME"
    CERT_ISSUER = "CERT_ISSUER"
    CNAME_SUFFIX = "CNAME_SUFFIX"
    NS_SUFFIX = "NS_SUFFIX"
    STATUS_MARKER = "STATUS_MARKER"


@dataclass(frozen=True)
class EdgeSignal:
    """A supporting signal. Only its kind and name are kept, never a header or cookie value."""

    type: EdgeSignalType
    name: str


@dataclass(frozen=True)
class EdgeDetection:
    vendor: str
    layer: EdgeLayer
    confidence: FindingConfidence
    signals: tuple[EdgeSignal, ...]


@dataclass(frozen=True)
class EdgeProfile:
    """Observation, not a finding: which edge layers were seen in front of the monitor."""

    detections: tuple[EdgeDetection, ...] = ()
    challenge_observed: bool = False


@dataclass(frozen=True)
class RecordChange:
    """Added and removed normalized values of one DNS record type in one scope."""

    scope: str
    record_type: str
    added: tuple[str, ...]
    removed: tuple[str, ...]


@dataclass(frozen=True)
class DnsOutcome:
    """What a DNS_WATCH scan stores besides findings: the baseline document and what changed."""

    host: str
    organization_domain: str
    snapshot: dict[str, object]
    changes: tuple[RecordChange, ...] = ()


@dataclass(frozen=True)
class ScanResult:
    # None only for kinds whose request never produced a response (see SECURITY_POSTURE).
    status_code: int | None
    response_time_ms: int | None
    findings: tuple[ScanFinding, ...] = ()
    sub_checks: tuple[SubCheckResult, ...] = ()
    # None when the kind produces no edge observation or the check was skipped.
    edge_profile: EdgeProfile | None = None
    # None for every kind but DNS_WATCH.
    dns_outcome: DnsOutcome | None = None

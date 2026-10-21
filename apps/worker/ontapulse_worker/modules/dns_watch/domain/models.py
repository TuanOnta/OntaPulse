"""Plain data of the DNS watch. Nothing here performs I/O."""

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum


class RecordType(StrEnum):
    A = "A"
    AAAA = "AAAA"
    CNAME = "CNAME"
    NS = "NS"
    MX = "MX"
    TXT = "TXT"


class AnswerStatus(StrEnum):
    OK = "OK"
    NXDOMAIN = "NXDOMAIN"
    # The name exists but has no record of the asked type.
    NODATA = "NODATA"
    # Timeout, SERVFAIL, or no resolver reachable: no statement about the record can be made.
    TRANSIENT = "TRANSIENT"


@dataclass(frozen=True)
class DnsAnswer:
    status: AnswerStatus
    values: tuple[str, ...] = ()


SCOPE_HOST = "host"
SCOPE_ORGANIZATION = "organization"

HOST_RECORD_TYPES = (
    RecordType.A,
    RecordType.AAAA,
    RecordType.CNAME,
    RecordType.NS,
    RecordType.MX,
    RecordType.TXT,
)
ORGANIZATION_RECORD_TYPES = (RecordType.NS, RecordType.MX)


@dataclass(frozen=True)
class Snapshot:
    """Normalized records of one scan. A value of None means the query failed (unknown)."""

    host_name: str
    host: Mapping[str, tuple[str, ...] | None]
    organization_name: str
    organization: Mapping[str, tuple[str, ...] | None]

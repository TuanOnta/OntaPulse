"""Ports of the DNS watch. Adapters implement them; domain and application never import a DNS
library."""

from collections.abc import Mapping
from typing import Any, Protocol
from uuid import UUID

from ontapulse_worker.modules.dns_watch.domain.models import DnsAnswer, RecordType


class DnsResolver(Protocol):
    def query(self, name: str, record_type: RecordType) -> DnsAnswer:
        """One DNS query to the configured public resolvers. Never raises for DNS conditions.

        `NXDOMAIN` and `NODATA` are answers; a timeout, SERVFAIL, or unreachable resolvers are
        `TRANSIENT`. Only a CNAME answer is followed for the other types, as a resolver does.
        """
        ...


class DnsWatchStore(Protocol):
    def load_baseline(self, monitor_id: UUID) -> Mapping[str, Any] | None:
        """The stored snapshot document of the monitor, or None before the first scan."""
        ...

    def has_cdn_detection(self, monitor_id: UUID) -> bool:
        """True when the monitor's current edge profile has a CDN detection (Phase 4)."""
        ...

"""Plain input for the pure edge detector. Nothing here performs I/O."""

from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class EdgeResponse:
    """What one response reveals. Header names are lowercase; cookie values are never kept."""

    status_code: int
    headers: Mapping[str, tuple[str, ...]]
    cookie_names: tuple[str, ...] = ()


@dataclass(frozen=True)
class EdgeInput:
    """Everything the detector may read. The DNS fields are filled from Phase 6 onward."""

    responses: tuple[EdgeResponse, ...]
    tls_issuer: str | None = None
    cname_targets: tuple[str, ...] = ()
    ns_targets: tuple[str, ...] = ()

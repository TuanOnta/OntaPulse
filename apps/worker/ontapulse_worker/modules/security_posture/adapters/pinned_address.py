"""Resolve a host once and pick a validated public address to connect to.

Shared by every posture connection (HTTP requests and the TLS handshake) so that the address
that was validated is the address that is used. The host is never resolved again before
connecting, which closes the DNS rebinding window.
"""

from ipaddress import IPv4Address, ip_address

from ontapulse_worker.modules.scans.adapters.http.url_security import (
    AddressResolver,
    ensure_public_address,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError


def resolve_pinned_address(resolver: AddressResolver, hostname: str, port: int) -> str:
    """Return one address of `hostname`, after requiring every resolved address to be public.

    Raises `ScanExecutionError` when the host does not resolve or any address is not public.
    """
    try:
        addresses = set(resolver(hostname, port))
    except (OSError, UnicodeError) as error:
        raise ScanExecutionError("Scan target hostname could not be resolved") from error

    if not addresses:
        raise ScanExecutionError("Scan target hostname could not be resolved")

    for address in addresses:
        ensure_public_address(address)

    # Deterministic choice: IPv4 first, then lexical order. Scope ids are stripped.
    parsed = [ip_address(address.split("%", maxsplit=1)[0]) for address in addresses]
    chosen = min(parsed, key=lambda item: (0 if isinstance(item, IPv4Address) else 1, str(item)))

    return str(chosen)

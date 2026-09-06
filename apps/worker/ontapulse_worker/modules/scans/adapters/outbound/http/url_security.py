"""Validation for user-controlled HTTP scan targets."""

import socket
from collections.abc import Callable, Collection
from ipaddress import ip_address
from typing import Protocol
from urllib.parse import urlsplit

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError

AddressResolver = Callable[[str, int], Collection[str]]


class TargetUrlValidator(Protocol):
    def validate(self, target_url: str) -> None: ...


def resolve_host_addresses(
    hostname: str,
    port: int,
) -> set[str]:
    addresses = socket.getaddrinfo(
        hostname,
        port,
        type=socket.SOCK_STREAM,
        proto=socket.IPPROTO_TCP,
    )

    return {str(address[4][0]) for address in addresses}


class PublicTargetUrlValidator:
    """Allow only HTTP targets that resolve to public IP addresses."""

    def __init__(
        self,
        resolver: AddressResolver = resolve_host_addresses,
    ) -> None:
        self._resolver = resolver

    def validate(self, target_url: str) -> None:
        try:
            parsed_url = urlsplit(target_url)
            hostname = parsed_url.hostname
            configured_port = parsed_url.port
        except ValueError as error:
            raise ScanExecutionError("Scan target URL is invalid") from error

        if parsed_url.scheme not in {"http", "https"}:
            raise ScanExecutionError("Scan target URL is invalid")

        if hostname is None:
            raise ScanExecutionError("Scan target URL is invalid")

        if parsed_url.username is not None or parsed_url.password is not None:
            raise ScanExecutionError("Scan target URL is invalid")

        if configured_port is None:
            port = 443 if parsed_url.scheme == "https" else 80
        else:
            port = configured_port

        if port < 1 or port > 65_535:
            raise ScanExecutionError("Scan target URL is invalid")

        try:
            resolved_addresses = self._resolver(hostname, port)
        except (OSError, UnicodeError) as error:
            raise ScanExecutionError("Scan target hostname could not be resolved") from error

        if not resolved_addresses:
            raise ScanExecutionError("Scan target hostname could not be resolved")

        for resolved_address in resolved_addresses:
            self._validate_address(resolved_address)

    @staticmethod
    def _validate_address(address: str) -> None:
        # Menghapus IPv6 scope ID, misalnya fe80::1%eth0.
        address_without_scope = address.split("%", maxsplit=1)[0]

        try:
            parsed_address = ip_address(address_without_scope)
        except ValueError as error:
            raise ScanExecutionError("Scan target address is invalid") from error

        if not parsed_address.is_global:
            raise ScanExecutionError("Scan target is not publicly reachable")

"""Standard-library `ssl` implementation of the TlsInspector port.

One TCP connection to a validated address, one handshake with certificate verification, no
application data sent or read. The client context accepts old protocol versions so that a
server whose best version is TLS 1.0 or 1.1 can be observed (see docs/security-checks.md 6.5);
certificate verification stays on.
"""

import socket
import ssl
import warnings
from collections.abc import Callable
from datetime import UTC, datetime

from ontapulse_worker.modules.scans.adapters.http.url_security import (
    AddressResolver,
    resolve_host_addresses,
)
from ontapulse_worker.modules.security_posture.adapters.pinned_address import (
    resolve_pinned_address,
)
from ontapulse_worker.modules.security_posture.application.ports import TlsConnectionError
from ontapulse_worker.modules.security_posture.domain.catalog import (
    MAX_VERIFY_MESSAGE_CHARS,
    TLS_CONNECT_TIMEOUT_SECONDS,
    TLS_HANDSHAKE_TIMEOUT_SECONDS,
)
from ontapulse_worker.modules.security_posture.domain.models import TlsObservation, TlsOutcome

PinAddress = Callable[[str, int], str]
Connector = Callable[[tuple[str, int], float], socket.socket]
MAX_FIELD_CHARS = 200


def create_probe_context() -> ssl.SSLContext:
    """Verifying client context that still accepts TLS 1.0 and 1.1 for observation only."""
    context = ssl.create_default_context()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        context.minimum_version = ssl.TLSVersion.TLSv1

    context.set_ciphers("DEFAULT:@SECLEVEL=0")

    return context


def _connect(address: tuple[str, int], timeout: float) -> socket.socket:
    return socket.create_connection(address, timeout=timeout)


class SslTlsInspector:
    def __init__(
        self,
        *,
        resolver: AddressResolver = resolve_host_addresses,
        pin_address: PinAddress | None = None,
        context_factory: Callable[[], ssl.SSLContext] = create_probe_context,
        connector: Connector = _connect,
    ) -> None:
        # `pin_address` exists so tests can reach a loopback server; the default validates that
        # every resolved address is public and returns one of them.
        self._pin_address: PinAddress = pin_address or (
            lambda host, port: resolve_pinned_address(resolver, host, port)
        )
        self._context_factory = context_factory
        self._connector = connector

    def inspect(self, host: str, port: int) -> TlsObservation:
        address = self._pin_address(host, port)

        try:
            raw_socket = self._connector((address, port), TLS_CONNECT_TIMEOUT_SECONDS)
        except OSError as error:
            raise TlsConnectionError("tcp connection failed") from error

        try:
            raw_socket.settimeout(TLS_HANDSHAKE_TIMEOUT_SECONDS)

            with self._context_factory().wrap_socket(raw_socket, server_hostname=host) as tls:
                return self._observe(tls)
        except ssl.SSLCertVerificationError as error:
            return TlsObservation(
                outcome=TlsOutcome.CERT_VERIFICATION_FAILED,
                verify_code=error.verify_code,
                verify_message=(error.verify_message or "")[:MAX_VERIFY_MESSAGE_CHARS],
            )
        except ssl.SSLError as error:
            return TlsObservation(
                outcome=TlsOutcome.NO_TLS,
                error_reason=(error.reason or "handshake_failed")[:MAX_VERIFY_MESSAGE_CHARS],
            )
        except OSError as error:
            raise TlsConnectionError("tls handshake did not complete") from error
        finally:
            raw_socket.close()

    @staticmethod
    def _observe(tls: ssl.SSLSocket) -> TlsObservation:
        certificate = tls.getpeercert() or {}

        return TlsObservation(
            outcome=TlsOutcome.HANDSHAKE_OK,
            protocol=tls.version(),
            subject_cn=_name(certificate.get("subject"), "commonName"),
            issuer=_name(certificate.get("issuer"), "organizationName")
            or _name(certificate.get("issuer"), "commonName"),
            not_before=_parse_time(certificate.get("notBefore")),
            not_after=_parse_time(certificate.get("notAfter")),
        )


def _name(rdns: object, key: str) -> str | None:
    """Pick one attribute out of the nested tuples `getpeercert()` returns, bounded in length."""
    if not isinstance(rdns, tuple):
        return None

    for rdn in rdns:
        for attribute in rdn:
            if len(attribute) == 2 and attribute[0] == key:
                return str(attribute[1])[:MAX_FIELD_CHARS]

    return None


def _parse_time(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None

    try:
        return datetime.fromtimestamp(ssl.cert_time_to_seconds(value), tz=UTC)
    except ValueError:
        return None

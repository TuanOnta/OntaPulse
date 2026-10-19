"""Handshake tests against a loopback TLS server started inside the test process.

The fixtures under tests/fixtures/tls are test-only. No test contacts the public internet.
"""

import socket
import ssl
import threading
from pathlib import Path

import pytest

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.security_posture.adapters.tls import ssl_tls_inspector
from ontapulse_worker.modules.security_posture.adapters.tls.ssl_tls_inspector import (
    SslTlsInspector,
    create_probe_context,
)
from ontapulse_worker.modules.security_posture.application.ports import TlsConnectionError
from ontapulse_worker.modules.security_posture.domain.models import TlsOutcome

FIXTURES = Path(__file__).resolve().parents[5] / "fixtures" / "tls"
CA = FIXTURES / "ca.pem"
LOOPBACK = "127.0.0.1"


class LoopbackServer:
    """Accepts connections on 127.0.0.1 and either speaks TLS or answers in plain text."""

    def __init__(
        self,
        cert: str | None = None,
        *,
        minimum: ssl.TLSVersion | None = None,
        maximum: ssl.TLSVersion | None = None,
        silent: bool = False,
    ) -> None:
        self.received: list[bytes] = []
        self.handshake_errors: list[str] = []
        self._silent = silent
        self._context: ssl.SSLContext | None = None

        if cert is not None:
            context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            context.load_cert_chain(FIXTURES / f"{cert}.pem", FIXTURES / f"{cert}.key")

            if minimum is not None:
                context.set_ciphers("DEFAULT:@SECLEVEL=0")
                context.minimum_version = minimum
                context.maximum_version = maximum or minimum

            self._context = context

        self._listener = socket.socket()
        self._listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._listener.bind((LOOPBACK, 0))
        self._listener.listen(8)
        self.port: int = self._listener.getsockname()[1]
        self._thread = threading.Thread(target=self._serve, daemon=True)
        self._thread.start()

    def _serve(self) -> None:
        while True:
            try:
                connection, _ = self._listener.accept()
            except OSError:
                return

            threading.Thread(target=self._handle, args=(connection,), daemon=True).start()

    def _handle(self, connection: socket.socket) -> None:
        connection.settimeout(2)

        try:
            if self._silent:
                connection.recv(1)
                return

            if self._context is None:
                connection.recv(1024)
                connection.sendall(b"HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n")
                return

            with self._context.wrap_socket(connection, server_side=True) as tls:
                try:
                    data = tls.recv(1024)
                except (TimeoutError, ssl.SSLError, OSError):
                    data = b""

                self.received.append(data)
        except ssl.SSLError as error:
            self.handshake_errors.append(str(error))
        except OSError:
            pass
        finally:
            connection.close()

    def close(self) -> None:
        self._listener.close()


@pytest.fixture
def serve():
    servers: list[LoopbackServer] = []

    def start(*args, **kwargs) -> LoopbackServer:
        server = LoopbackServer(*args, **kwargs)
        servers.append(server)
        return server

    yield start

    for server in servers:
        server.close()


def trusting_context() -> ssl.SSLContext:
    context = create_probe_context()
    context.load_verify_locations(CA)

    return context


def inspector(**overrides) -> SslTlsInspector:
    options = {"pin_address": lambda _host, _port: LOOPBACK, "context_factory": trusting_context}
    options.update(overrides)

    return SslTlsInspector(**options)


def test_a_valid_certificate_reports_the_certificate_and_protocol(serve) -> None:
    server = serve("valid")

    observation = inspector().inspect("example.test", server.port)

    assert observation.outcome is TlsOutcome.HANDSHAKE_OK
    assert observation.protocol in {"TLSv1.2", "TLSv1.3"}
    assert observation.subject_cn == "example.test"
    assert observation.issuer == "OntaPulse Test CA"
    assert observation.not_before.year == 2020
    assert observation.not_after.year == 2120
    assert observation.not_after.tzinfo is not None


def test_the_handshake_sends_and_reads_no_application_data(serve) -> None:
    server = serve("valid")

    inspector().inspect("example.test", server.port)

    # The server waited for application data and got none.
    deadline = threading.Event()
    deadline.wait(0.3)
    assert server.received in ([], [b""])


@pytest.mark.parametrize(
    ("cert", "code", "message_part"),
    [
        ("expired", 10, "expired"),
        ("not-yet-valid", 9, "not yet valid"),
        ("wrong-host", 62, "mismatch"),
        ("self-signed", 18, "self-signed"),
    ],
)
def test_verification_failures_carry_the_openssl_verify_code(
    serve, cert: str, code: int, message_part: str
) -> None:
    server = serve(cert)

    observation = inspector().inspect("example.test", server.port)

    assert observation.outcome is TlsOutcome.CERT_VERIFICATION_FAILED
    assert observation.verify_code == code
    assert message_part in (observation.verify_message or "").lower()
    assert observation.not_after is None


def test_a_server_that_does_not_speak_tls_is_reported_as_no_tls(serve) -> None:
    server = serve()

    observation = inspector().inspect("example.test", server.port)

    assert observation.outcome is TlsOutcome.NO_TLS
    assert observation.error_reason


def test_a_refused_connection_is_a_connection_error_not_a_result() -> None:
    probe = socket.socket()
    probe.bind((LOOPBACK, 0))
    port = probe.getsockname()[1]
    probe.close()

    with pytest.raises(TlsConnectionError):
        inspector().inspect("example.test", port)


def test_a_silent_server_hits_the_handshake_timeout(serve, monkeypatch) -> None:
    monkeypatch.setattr(ssl_tls_inspector, "TLS_HANDSHAKE_TIMEOUT_SECONDS", 0.3)
    server = serve(silent=True)

    with pytest.raises(TlsConnectionError):
        inspector().inspect("example.test", server.port)


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
@pytest.mark.parametrize(
    ("version", "expected"),
    [(ssl.TLSVersion.TLSv1_1, "TLSv1.1"), (ssl.TLSVersion.TLSv1, "TLSv1")],
)
def test_an_old_only_server_is_observed_with_its_protocol(serve, version, expected) -> None:
    try:
        server = serve("valid", minimum=version, maximum=version)
        observation = inspector().inspect("example.test", server.port)
    except (ssl.SSLError, TlsConnectionError, ValueError) as error:  # pragma: no cover
        pytest.skip(f"this OpenSSL build cannot serve {expected}: {error}")

    if observation.outcome is not TlsOutcome.HANDSHAKE_OK:
        pytest.skip(f"this OpenSSL build cannot serve {expected}: {server.handshake_errors}")

    assert observation.protocol == expected


def test_the_probe_context_verifies_certificates_and_accepts_old_versions() -> None:
    context = create_probe_context()

    assert context.verify_mode is ssl.CERT_REQUIRED
    assert context.check_hostname is True
    assert context.minimum_version is ssl.TLSVersion.TLSv1


def test_a_private_address_is_rejected_before_any_connection() -> None:
    connections: list[tuple[str, int]] = []

    def connector(address, _timeout):
        connections.append(address)
        raise AssertionError("must not connect")

    resolver_calls: list[tuple[str, int]] = []

    def resolver(host: str, port: int) -> set[str]:
        resolver_calls.append((host, port))
        return {"10.0.0.5"}

    tls = SslTlsInspector(resolver=resolver, connector=connector)

    with pytest.raises(ScanExecutionError, match="not publicly reachable"):
        tls.inspect("example.com", 443)

    assert connections == []
    assert resolver_calls == [("example.com", 443)]


def test_the_connection_goes_to_the_address_that_was_validated() -> None:
    resolver_calls: list[tuple[str, int]] = []
    connected: list[tuple[str, int]] = []

    def resolver(host: str, port: int) -> set[str]:
        resolver_calls.append((host, port))
        # A later answer would be private, but the host is resolved only once.
        return {"93.184.216.34"} if len(resolver_calls) == 1 else {"10.0.0.5"}

    def connector(address, _timeout):
        connected.append(address)
        raise OSError("stop here")

    tls = SslTlsInspector(resolver=resolver, connector=connector)

    with pytest.raises(TlsConnectionError):
        tls.inspect("example.com", 443)

    assert connected == [("93.184.216.34", 443)]
    assert len(resolver_calls) == 1

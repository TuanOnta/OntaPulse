"""HTTPX implementation of the PostureHttpClient port with connection pinning.

The host is resolved exactly once per request. Every resolved address must be public and the
connection goes to one of those addresses, so the address cannot change between validation and
connect (DNS rebinding). For HTTPS the monitor host is sent as the SNI name and the certificate
is verified against it (httpcore `sni_hostname` extension, httpcore 1.0.9).
"""

from collections.abc import Callable
from importlib import metadata
from ipaddress import IPv4Address, ip_address
from time import perf_counter
from urllib.parse import urlsplit, urlunsplit

import httpx

from ontapulse_worker.modules.scans.adapters.http.url_security import (
    AddressResolver,
    ensure_public_address,
    resolve_host_addresses,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.security_posture.application.ports import PostureConnectionError
from ontapulse_worker.modules.security_posture.domain.catalog import (
    USER_AGENT_PRODUCT,
    USER_AGENT_PROJECT_URL,
)
from ontapulse_worker.modules.security_posture.domain.cookie_rules import parse_set_cookie
from ontapulse_worker.modules.security_posture.domain.models import CookieInfo, PostureResponse

CONNECT_TIMEOUT_SECONDS = 5.0
READ_TIMEOUT_SECONDS = 30.0
WRITE_TIMEOUT_SECONDS = 5.0
POOL_TIMEOUT_SECONDS = 5.0
MAX_COOKIES = 50
# Never kept from a response, even as a header name lookup.
DROPPED_HEADERS = frozenset({"set-cookie", "authorization", "proxy-authorization"})


def build_user_agent() -> str:
    try:
        version = metadata.version("ontapulse-worker")
    except metadata.PackageNotFoundError:
        version = "0"

    return f"{USER_AGENT_PRODUCT}/{version} (+{USER_AGENT_PROJECT_URL})"


class PinnedHttpxClient:
    def __init__(
        self,
        client: httpx.Client | None = None,
        *,
        resolver: AddressResolver = resolve_host_addresses,
        clock: Callable[[], float] = perf_counter,
    ) -> None:
        self._client = client or httpx.Client(
            timeout=httpx.Timeout(
                connect=CONNECT_TIMEOUT_SECONDS,
                read=READ_TIMEOUT_SECONDS,
                write=WRITE_TIMEOUT_SECONDS,
                pool=POOL_TIMEOUT_SECONDS,
            ),
            follow_redirects=False,
        )
        self._owns_client = client is None
        self._resolver = resolver
        self._clock = clock
        self._user_agent = build_user_agent()

    def fetch(self, url: str) -> PostureResponse:
        parts = urlsplit(url)
        hostname, port = self._validated_host_and_port(url)
        address = self._pinned_address(hostname, port)

        literal = f"[{address}]" if ":" in address else address
        pinned_url = urlunsplit(
            (parts.scheme, f"{literal}:{port}", parts.path or "/", parts.query, "")
        )
        default_port = 443 if parts.scheme == "https" else 80
        host_header = hostname if port == default_port else f"{hostname}:{port}"
        extensions = {"sni_hostname": hostname} if parts.scheme == "https" else {}
        started_at = self._clock()

        try:
            with self._client.stream(
                "GET",
                pinned_url,
                headers={"Host": host_header, "User-Agent": self._user_agent},
                extensions=extensions,
            ) as response:
                # The body is never read.
                elapsed_ms = max(0, round((self._clock() - started_at) * 1_000))
                headers = self._collect_headers(response)
                cookies = self._collect_cookies(response)
                status_code = response.status_code
        except httpx.RequestError as error:
            raise PostureConnectionError("request failed") from error

        return PostureResponse(
            url=url,
            status_code=status_code,
            headers=headers,
            cookies=cookies,
            elapsed_ms=elapsed_ms,
        )

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    @staticmethod
    def _validated_host_and_port(url: str) -> tuple[str, int]:
        try:
            parts = urlsplit(url)
            hostname = parts.hostname
            port = parts.port
        except ValueError as error:
            raise ScanExecutionError("Scan target URL is invalid") from error

        if parts.scheme not in {"http", "https"} or hostname is None:
            raise ScanExecutionError("Scan target URL is invalid")

        if parts.username is not None or parts.password is not None:
            raise ScanExecutionError("Scan target URL is invalid")

        resolved_port = port if port is not None else (443 if parts.scheme == "https" else 80)

        if not 1 <= resolved_port <= 65_535:
            raise ScanExecutionError("Scan target URL is invalid")

        return hostname, resolved_port

    def _pinned_address(self, hostname: str, port: int) -> str:
        try:
            addresses = set(self._resolver(hostname, port))
        except (OSError, UnicodeError) as error:
            raise ScanExecutionError("Scan target hostname could not be resolved") from error

        if not addresses:
            raise ScanExecutionError("Scan target hostname could not be resolved")

        for address in addresses:
            ensure_public_address(address)

        # Deterministic choice: IPv4 first, then lexical order.
        def sort_key(address: str) -> tuple[int, str]:
            parsed = ip_address(address.split("%", maxsplit=1)[0])

            return (0 if isinstance(parsed, IPv4Address) else 1, str(parsed))

        return str(ip_address(min(addresses, key=sort_key).split("%", maxsplit=1)[0]))

    @staticmethod
    def _collect_headers(response: httpx.Response) -> dict[str, tuple[str, ...]]:
        collected: dict[str, list[str]] = {}

        for name, value in response.headers.multi_items():
            lowered = name.lower()

            if lowered in DROPPED_HEADERS:
                continue

            collected.setdefault(lowered, []).append(value)

        return {name: tuple(values) for name, values in collected.items()}

    @staticmethod
    def _collect_cookies(response: httpx.Response) -> tuple[CookieInfo, ...]:
        cookies: list[CookieInfo] = []

        for raw in response.headers.get_list("set-cookie")[:MAX_COOKIES]:
            cookie = parse_set_cookie(raw)

            if cookie is not None:
                cookies.append(cookie)

        return tuple(cookies)

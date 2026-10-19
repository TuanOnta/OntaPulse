import httpx
import pytest

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.security_posture.adapters.http.pinned_httpx_client import (
    PinnedHttpxClient,
    build_user_agent,
)
from ontapulse_worker.modules.security_posture.application.ports import PostureConnectionError

PUBLIC_IP = "93.184.216.34"
PUBLIC_IPV6 = "2606:2800:220:1:248:1893:25c8:1946"


class RecordingResolver:
    def __init__(self, *answers: set[str]) -> None:
        self._answers = list(answers)
        self.calls: list[tuple[str, int]] = []

    def __call__(self, hostname: str, port: int) -> set[str]:
        self.calls.append((hostname, port))
        index = min(len(self.calls) - 1, len(self._answers) - 1)

        return self._answers[index]


def client_with(handler, resolver) -> PinnedHttpxClient:
    transport = httpx.MockTransport(handler)

    return PinnedHttpxClient(
        httpx.Client(transport=transport, follow_redirects=False), resolver=resolver
    )


def ok(_request: httpx.Request) -> httpx.Response:
    return httpx.Response(200, headers={"x-test": "1"})


def test_the_request_goes_to_the_validated_address_with_host_and_sni_of_the_monitor() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200)

    resolver = RecordingResolver({PUBLIC_IP})

    client_with(handler, resolver).fetch("https://example.com/path?x=1")

    (request,) = seen
    assert request.url.host == PUBLIC_IP
    assert request.url.port is None  # httpx drops the scheme default port
    assert request.url.path == "/path"
    assert request.url.query == b"x=1"
    assert request.headers["host"] == "example.com"
    assert request.extensions["sni_hostname"] == "example.com"
    assert request.headers["user-agent"].startswith("OntaPulse-SecurityScanner/")
    assert resolver.calls == [("example.com", 443)]


def test_a_plain_http_request_is_pinned_too_and_sends_no_sni() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(301)

    resolver = RecordingResolver({PUBLIC_IP})

    response = client_with(handler, resolver).fetch("http://example.com:8080/")

    (request,) = seen
    assert request.url.host == PUBLIC_IP
    assert request.url.port == 8080
    assert request.headers["host"] == "example.com:8080"
    assert "sni_hostname" not in request.extensions
    assert response.status_code == 301


def test_an_ipv6_address_is_bracketed_in_the_pinned_url() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200)

    client_with(handler, RecordingResolver({PUBLIC_IPV6})).fetch("https://example.com/")

    assert seen[0].url.host == PUBLIC_IPV6


def test_a_dns_answer_that_changes_after_validation_cannot_redirect_the_connection() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200)

    # The second answer would be a private address, but it is never asked for.
    resolver = RecordingResolver({PUBLIC_IP}, {"10.0.0.5"})

    client_with(handler, resolver).fetch("https://example.com/")

    assert len(resolver.calls) == 1
    assert seen[0].url.host == PUBLIC_IP


@pytest.mark.parametrize(
    "answer",
    [
        {"10.0.0.5"},
        {"127.0.0.1"},
        {"169.254.169.254"},
        {"::1"},
        {"fe80::1%eth0"},
        {PUBLIC_IP, "192.168.1.10"},
    ],
)
def test_a_hostname_resolving_to_a_non_public_address_is_rejected_without_a_request(
    answer: set[str],
) -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200)

    with pytest.raises(ScanExecutionError, match="not publicly reachable"):
        client_with(handler, RecordingResolver(answer)).fetch("https://example.com/")

    assert calls == []


@pytest.mark.parametrize("answer", [set(), None])
def test_an_unresolvable_host_is_rejected(answer) -> None:
    def resolver(hostname: str, port: int):
        if answer is None:
            raise OSError("no such host")
        return answer

    with pytest.raises(ScanExecutionError, match="could not be resolved"):
        client_with(ok, resolver).fetch("https://example.com/")


@pytest.mark.parametrize(
    "url", ["ftp://example.com/", "https://user:pw@example.com/", "https:///x", "https://a:70000/"]
)
def test_invalid_urls_are_rejected_before_resolution(url: str) -> None:
    resolver = RecordingResolver({PUBLIC_IP})

    with pytest.raises(ScanExecutionError, match="invalid"):
        client_with(ok, resolver).fetch(url)

    assert resolver.calls == []


def test_a_redirect_is_returned_and_never_followed() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(302, headers={"location": "https://example.com/next?token=abc"})

    response = client_with(handler, RecordingResolver({PUBLIC_IP})).fetch("http://example.com/")

    assert len(requests) == 1
    assert response.status_code == 302
    assert response.headers["location"] == ("https://example.com/next?token=abc",)


def test_cookie_values_and_credential_headers_never_leave_the_adapter() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            headers=[
                ("set-cookie", "sid=SECRET-COOKIE-VALUE; Secure; HttpOnly; SameSite=Lax"),
                ("set-cookie", "theme=dark"),
                ("authorization", "Bearer SECRET-TOKEN"),
                ("Strict-Transport-Security", "max-age=1"),
            ],
        )

    response = PinnedHttpxClient(
        httpx.Client(transport=httpx.MockTransport(handler)),
        resolver=RecordingResolver({PUBLIC_IP}),
    ).fetch("https://example.com/")

    assert [cookie.name for cookie in response.cookies] == ["sid", "theme"]
    assert "set-cookie" not in response.headers
    assert "authorization" not in response.headers
    assert response.headers["strict-transport-security"] == ("max-age=1",)
    assert "SECRET" not in repr(response)


def test_the_response_body_is_not_read() -> None:
    class Body(httpx.SyncByteStream):
        read = False

        def __iter__(self):
            Body.read = True
            yield b"secret body"

    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, stream=Body())

    client_with(handler, RecordingResolver({PUBLIC_IP})).fetch("https://example.com/")

    assert Body.read is False


@pytest.mark.parametrize(
    "error",
    [httpx.ConnectTimeout("t"), httpx.ConnectError("refused"), httpx.ReadTimeout("slow")],
)
def test_transport_failures_become_connection_errors(error: Exception) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise error

    with pytest.raises(PostureConnectionError):
        client_with(handler, RecordingResolver({PUBLIC_IP})).fetch("https://example.com/")


def test_the_user_agent_names_ontapulse_and_does_not_pretend_to_be_a_browser() -> None:
    agent = build_user_agent()

    assert agent.startswith("OntaPulse-SecurityScanner/")
    assert "Mozilla" not in agent
    assert "github.com/TuanOnta/OntaPulse" in agent


def test_default_client_timeouts() -> None:
    client = PinnedHttpxClient()

    try:
        timeout = client._client.timeout
        assert (timeout.connect, timeout.read, timeout.write, timeout.pool) == (5.0, 30.0, 5.0, 5.0)
        assert client._client.follow_redirects is False
    finally:
        client.close()

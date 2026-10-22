from datetime import UTC, datetime

import pytest

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import ScanOptions
from ontapulse_worker.modules.security_posture.application.ports import PostureConnectionError
from ontapulse_worker.modules.security_posture.application.posture_scan import (
    PostureScanExecutor,
    RequestBudget,
    RequestBudgetExceededError,
)
from ontapulse_worker.modules.security_posture.domain.models import (
    PostureResponse,
    ProbeResponse,
    TlsObservation,
    TlsOutcome,
)

NOW = datetime(2026, 10, 20, 12, 0, tzinfo=UTC)
ON = ScanOptions(path_probes_enabled=True)
OFF = ScanOptions(path_probes_enabled=False)
GOOD_HEADERS = {
    "strict-transport-security": ("max-age=31536000; includeSubDomains",),
    "content-security-policy": ("default-src 'self'; frame-ancestors 'none'",),
    "x-content-type-options": ("nosniff",),
    "referrer-policy": ("no-referrer",),
    "permissions-policy": ("geolocation=()",),
}
VALID_TLS = TlsObservation(
    outcome=TlsOutcome.HANDSHAKE_OK,
    protocol="TLSv1.3",
    subject_cn="example.com",
    issuer="Test CA",
    not_before=datetime(2026, 1, 1, tzinfo=UTC),
    not_after=datetime(2027, 6, 1, tzinfo=UTC),
)


def page(url: str, status: int = 200, headers=None) -> PostureResponse:
    return PostureResponse(
        url=url,
        status_code=status,
        headers=GOOD_HEADERS if headers is None else headers,
        cookies=(),
        elapsed_ms=10,
    )


def probe_reply(status: int = 404, body: bytes = b"", headers=None, cookies=()) -> ProbeResponse:
    return ProbeResponse(
        status_code=status,
        headers={} if headers is None else headers,
        cookie_names=cookies,
        body_prefix=body,
    )


class FakeTls:
    def __init__(self) -> None:
        self.calls = 0

    def inspect(self, host: str, port: int) -> TlsObservation:
        self.calls += 1
        return VALID_TLS


class FakeClient:
    """`probes` maps a path to a ProbeResponse or an Exception to raise."""

    def __init__(self, https, probes=None) -> None:
        self._https = https
        self._probes = probes or {}
        self.fetched: list[str] = []
        self.probed: list[str] = []

    def fetch(self, url: str) -> PostureResponse:
        self.fetched.append(url)

        if url.startswith("https"):
            if isinstance(self._https, Exception):
                raise self._https
            return self._https

        return page(url, 301, {"location": ("https://example.com/",)})

    def probe(self, url: str) -> ProbeResponse:
        self.probed.append(url)
        path = "/" + url.split("/", maxsplit=3)[3]
        answer = self._probes.get(path, probe_reply())

        if isinstance(answer, Exception):
            raise answer

        return answer


def run(client: FakeClient, options=ON, tls=None):
    return PostureScanExecutor(client, tls or FakeTls(), now=lambda: NOW).execute(
        "https://example.com", options=options
    )


def exposed(result):
    return next(item for item in result.sub_checks if item.name == "exposed_files")


def probe_findings(result):
    return [f for f in result.findings if f.check_id.startswith("SEC_EXPOSED_")]


def test_probes_do_not_run_when_the_setting_is_off_and_the_sub_check_says_why() -> None:
    for options in (OFF, None):
        client = FakeClient(page("https://example.com/"))

        result = run(client, options)

        assert client.probed == []
        assert (exposed(result).state.value, exposed(result).reason) == ("skipped", "not_enabled")
        assert probe_findings(result) == []


def test_probes_go_to_the_three_fixed_paths_in_order_over_https_with_no_query() -> None:
    client = FakeClient(page("https://example.com/a?token=1"))

    PostureScanExecutor(client, FakeTls(), now=lambda: NOW).execute(
        "https://example.com:8443/a?token=1", options=ON
    )

    assert client.probed == [
        "https://example.com:8443/.env",
        "https://example.com:8443/.git/HEAD",
        "https://example.com:8443/.git/config",
    ]


def test_the_scan_makes_two_requests_three_probes_and_one_handshake() -> None:
    tls = FakeTls()
    client = FakeClient(page("https://example.com/"))

    run(client, tls=tls)

    assert len(client.fetched) == 2
    assert len(client.probed) == 3
    assert tls.calls == 1


def test_a_matching_signature_becomes_a_finding_with_no_body_content() -> None:
    secret = "PRIVATE_VALUE_42"
    client = FakeClient(
        page("https://example.com/"),
        {
            "/.env": probe_reply(200, f"APP_KEY={secret}\n".encode()),
            "/.git/HEAD": probe_reply(200, b"ref: refs/heads/main\n"),
            "/.git/config": probe_reply(404),
        },
    )

    result = run(client)

    findings = {f.check_id: f for f in probe_findings(result)}
    assert set(findings) == {"SEC_EXPOSED_ENV_FILE", "SEC_EXPOSED_GIT_HEAD"}
    assert findings["SEC_EXPOSED_ENV_FILE"].evidence == {
        "path": "/.env",
        "status": 200,
        "signature": "dotenv",
    }
    assert secret not in repr(result)
    assert exposed(result).state.value == "ran"


def test_a_clean_host_has_no_exposed_file_finding_and_the_check_ran() -> None:
    result = run(FakeClient(page("https://example.com/")))

    assert probe_findings(result) == []
    assert (exposed(result).state.value, exposed(result).reason) == ("ran", None)


def test_a_single_page_app_answering_200_everywhere_produces_nothing() -> None:
    shell = probe_reply(200, b"<!doctype html><html><body>app</body></html>")
    client = FakeClient(
        page("https://example.com/"),
        {"/.env": shell, "/.git/HEAD": shell, "/.git/config": shell},
    )

    result = run(client)

    assert probe_findings(result) == []
    assert exposed(result).state.value == "ran"


def test_a_confirmed_challenge_on_the_main_response_skips_every_probe() -> None:
    client = FakeClient(
        page("https://example.com/", 202, {"x-amzn-waf-action": ("challenge",)}),
    )

    result = run(client)

    assert client.probed == []
    assert (exposed(result).state.value, exposed(result).reason) == (
        "skipped",
        "challenge_response",
    )


def test_a_challenge_on_one_probe_is_dropped_for_that_path_only() -> None:
    client = FakeClient(
        page("https://example.com/"),
        {
            "/.env": probe_reply(403, b"APP_KEY=x", cookies=("datadome",)),
            "/.git/config": probe_reply(200, b"[core]\n"),
        },
    )

    result = run(client)

    assert [f.check_id for f in probe_findings(result)] == ["SEC_EXPOSED_GIT_CONFIG"]
    assert exposed(result).state.value == "ran"


def test_when_every_probe_is_a_challenge_the_sub_check_is_skipped_for_that_reason() -> None:
    blocked = probe_reply(202, headers={"x-amzn-waf-action": ("challenge",)})
    client = FakeClient(
        page("https://example.com/"),
        {"/.env": blocked, "/.git/HEAD": blocked, "/.git/config": blocked},
    )

    result = run(client)

    assert probe_findings(result) == []
    assert (exposed(result).state.value, exposed(result).reason) == (
        "skipped",
        "challenge_response",
    )


def test_when_every_probe_fails_to_connect_the_scan_still_succeeds() -> None:
    down = PostureConnectionError("down")
    client = FakeClient(
        page("https://example.com/"),
        {"/.env": down, "/.git/HEAD": down, "/.git/config": down},
    )

    result = run(client)

    assert (exposed(result).state.value, exposed(result).reason) == (
        "skipped",
        "connection_failed",
    )
    assert result.status_code == 200


def test_one_failing_probe_does_not_stop_the_others() -> None:
    client = FakeClient(
        page("https://example.com/"),
        {
            "/.env": PostureConnectionError("reset"),
            "/.git/HEAD": probe_reply(200, SHA := b"0123456789abcdef0123456789abcdef01234567"),
        },
    )

    result = run(client)

    assert SHA
    assert [f.check_id for f in probe_findings(result)] == ["SEC_EXPOSED_GIT_HEAD"]
    assert len(client.probed) == 3


def test_a_probe_rejected_by_target_validation_is_skipped_not_fatal() -> None:
    # A DNS answer that turns non-public between the main request and a probe.
    rejected = ScanExecutionError("Scan target is not publicly reachable")
    client = FakeClient(
        page("https://example.com/"),
        {"/.env": rejected, "/.git/HEAD": rejected, "/.git/config": rejected},
    )

    result = run(client)

    assert result.status_code == 200
    assert exposed(result).reason == "connection_failed"


def test_probes_need_the_main_https_request_to_have_connected() -> None:
    client = FakeClient(PostureConnectionError("down"))

    result = run(client)

    assert client.probed == []
    assert (exposed(result).state.value, exposed(result).reason) == (
        "skipped",
        "prerequisite_failed",
    )


def test_probe_responses_are_not_fed_to_the_edge_detector() -> None:
    client = FakeClient(
        page("https://example.com/"),
        {"/.env": probe_reply(200, b"A=1", headers={"cf-ray": ("x",)})},
    )

    result = run(client)

    assert result.edge_profile is not None
    assert result.edge_profile.detections == ()


def test_the_probe_budget_is_separate_and_fixed() -> None:
    budget = RequestBudget()

    for _ in range(3):
        budget.consume_probe()

    with pytest.raises(RequestBudgetExceededError):
        budget.consume_probe()
    # The page requests and the handshake keep their own counters.
    budget.consume()
    budget.consume()
    budget.consume_handshake()

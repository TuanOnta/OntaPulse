from datetime import UTC, datetime

import pytest

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import FindingConfidence, SubCheckState
from ontapulse_worker.modules.security_posture.application.ports import (
    PostureConnectionError,
    TlsConnectionError,
)
from ontapulse_worker.modules.security_posture.application.posture_scan import (
    PostureScanExecutor,
    RequestBudget,
    RequestBudgetExceededError,
)
from ontapulse_worker.modules.security_posture.domain.models import (
    CookieInfo,
    PostureResponse,
    TlsObservation,
    TlsOutcome,
)

GOOD_HTTPS_HEADERS = {
    "strict-transport-security": ("max-age=31536000; includeSubDomains",),
    "content-security-policy": ("default-src 'self'; frame-ancestors 'none'",),
    "x-content-type-options": ("nosniff",),
    "referrer-policy": ("no-referrer",),
    "permissions-policy": ("geolocation=()",),
}


def reply(url: str, status: int = 200, headers=None, cookies=()) -> PostureResponse:
    return PostureResponse(
        url=url,
        status_code=status,
        headers={} if headers is None else headers,
        cookies=cookies,
        elapsed_ms=30,
    )


NOW = datetime(2026, 10, 19, 12, 0, tzinfo=UTC)
VALID_TLS = TlsObservation(
    outcome=TlsOutcome.HANDSHAKE_OK,
    protocol="TLSv1.3",
    subject_cn="example.com",
    issuer="Test CA",
    not_before=datetime(2026, 1, 1, tzinfo=UTC),
    not_after=datetime(2027, 6, 1, tzinfo=UTC),
)


class FakeTls:
    """Returns an observation, or raises when given an Exception."""

    def __init__(self, answer=VALID_TLS) -> None:
        self._answer = answer
        self.calls: list[tuple[str, int]] = []

    def inspect(self, host: str, port: int) -> TlsObservation:
        self.calls.append((host, port))

        if isinstance(self._answer, Exception):
            raise self._answer

        return self._answer


def executor(client, tls=None) -> PostureScanExecutor:
    return PostureScanExecutor(client, tls or FakeTls(), now=lambda: NOW)


class FakeClient:
    """Answers by scheme; an Exception value is raised instead of returned."""

    def __init__(self, https, http) -> None:
        self._answers = {"https": https, "http": http}
        self.urls: list[str] = []

    def fetch(self, url: str) -> PostureResponse:
        self.urls.append(url)
        answer = self._answers[url.split(":", maxsplit=1)[0]]

        if isinstance(answer, Exception):
            raise answer

        return answer


def states(result) -> dict[str, tuple[str, str | None]]:
    return {item.name: (item.state.value, item.reason) for item in result.sub_checks}


def test_a_clean_target_has_no_findings_and_every_sub_check_ran() -> None:
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.findings == ()
    assert result.status_code == 200
    assert result.response_time_ms == 30
    assert states(result) == {
        "headers": ("ran", None),
        "cookies": ("ran", None),
        "cors": ("ran", None),
        "redirect": ("ran", None),
        "tls": ("ran", None),
        "edge": ("ran", None),
        "exposed_files": ("skipped", "not_enabled"),
    }


def test_a_scan_makes_exactly_two_requests_to_the_derived_urls() -> None:
    client = FakeClient(reply("https://example.com/a"), reply("http://example.com/a", 301))

    executor(client).execute("http://example.com/a?x=1")

    assert client.urls == ["https://example.com/a?x=1", "http://example.com/a?x=1"]


def test_findings_from_every_sub_check_are_collected() -> None:
    cookie = CookieInfo(name="sid")
    client = FakeClient(
        reply(
            "https://example.com/",
            headers={"access-control-allow-origin": ("*",)},
            cookies=(cookie,),
        ),
        reply("http://example.com/", 200),
    )

    ids = {finding.check_id for finding in executor(client).execute("https://example.com").findings}

    assert {
        "SEC_HDR_HSTS_MISSING",
        "SEC_COOKIE_NO_SECURE",
        "SEC_CORS_WILDCARD_ORIGIN",
        "SEC_REDIRECT_NO_HTTPS",
    } <= ids


def test_a_failed_http_request_only_skips_the_redirect_check() -> None:
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS), PostureConnectionError()
    )

    result = executor(client).execute("https://example.com")

    assert states(result)["redirect"] == ("skipped", "connection_failed")
    assert states(result)["headers"] == ("ran", None)
    assert result.findings == ()


def test_a_failed_https_request_skips_header_cookie_and_cors_checks() -> None:
    client = FakeClient(PostureConnectionError(), reply("http://example.com/", 301))

    result = executor(client).execute("https://example.com")

    assert result.status_code is None
    assert states(result) == {
        "headers": ("skipped", "connection_failed"),
        "cookies": ("skipped", "connection_failed"),
        "cors": ("skipped", "connection_failed"),
        "redirect": ("ran", None),
        "tls": ("ran", None),
        "edge": ("ran", None),
        "exposed_files": ("skipped", "not_enabled"),
    }


def test_the_scan_fails_when_no_request_and_no_handshake_can_connect() -> None:
    client = FakeClient(PostureConnectionError(), PostureConnectionError())

    with pytest.raises(ScanExecutionError, match="unavailable"):
        executor(client, FakeTls(TlsConnectionError())).execute("https://example.com")

    assert len(client.urls) == 2


def test_a_tls_result_keeps_the_scan_alive_when_both_requests_fail() -> None:
    # An HTTPS GET fails on a bad certificate; the TLS check is what explains why.
    client = FakeClient(PostureConnectionError(), PostureConnectionError())
    broken = TlsObservation(
        outcome=TlsOutcome.CERT_VERIFICATION_FAILED,
        verify_code=10,
        verify_message="certificate has expired",
    )

    result = executor(client, FakeTls(broken)).execute("https://example.com")

    assert [finding.check_id for finding in result.findings] == ["SEC_TLS_CERT_EXPIRED"]
    assert states(result)["tls"] == ("ran", None)
    assert states(result)["headers"] == ("skipped", "connection_failed")


def test_one_handshake_is_made_to_the_https_host_and_port() -> None:
    tls = FakeTls()
    client = FakeClient(reply("https://example.com:8443/"), reply("http://example.com/", 301))

    executor(client, tls).execute("https://example.com:8443/path")

    assert tls.calls == [("example.com", 8443)]


def test_the_handshake_defaults_to_port_443_for_an_http_monitor() -> None:
    tls = FakeTls()
    client = FakeClient(reply("https://example.com/"), reply("http://example.com:8080/", 301))

    executor(client, tls).execute("http://example.com:8080/")

    assert tls.calls == [("example.com", 443)]


def test_a_failed_handshake_only_skips_the_tls_check() -> None:
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client, FakeTls(TlsConnectionError())).execute("https://example.com")

    assert states(result)["tls"] == ("skipped", "connection_failed")
    assert states(result)["headers"] == ("ran", None)
    assert result.findings == ()


def test_a_confirmed_challenge_does_not_skip_the_tls_check() -> None:
    client = FakeClient(
        reply("https://example.com/", 403, {"cf-mitigated": ("challenge",)}),
        reply("http://example.com/", 403, {"cf-mitigated": ("challenge",)}),
    )
    expiring = TlsObservation(
        outcome=TlsOutcome.HANDSHAKE_OK,
        protocol="TLSv1.3",
        not_after=datetime(2026, 10, 25, tzinfo=UTC),
    )

    result = executor(client, FakeTls(expiring)).execute("https://example.com")

    assert [finding.check_id for finding in result.findings] == ["SEC_TLS_CERT_EXPIRES_SOON_14"]
    assert states(result)["headers"] == ("skipped", "challenge_response")
    assert states(result)["tls"] == ("ran", None)


def test_a_rejected_target_fails_before_any_handshake() -> None:
    tls = FakeTls()
    client = FakeClient(ScanExecutionError("Scan target is not publicly reachable"), None)

    with pytest.raises(ScanExecutionError):
        executor(client, tls).execute("https://example.com")

    assert tls.calls == []


def test_a_second_handshake_is_refused_by_the_budget() -> None:
    budget = RequestBudget()
    budget.consume_handshake()

    with pytest.raises(RequestBudgetExceededError):
        budget.consume_handshake()


def test_a_rejected_target_fails_the_scan_before_the_second_request() -> None:
    client = FakeClient(ScanExecutionError("Scan target is not publicly reachable"), None)

    with pytest.raises(ScanExecutionError, match="not publicly reachable"):
        executor(client).execute("https://example.com")

    assert client.urls == ["https://example.com/"]


def test_a_confirmed_challenge_suppresses_the_findings_of_that_response() -> None:
    client = FakeClient(
        reply("https://example.com/", 403, {"cf-mitigated": ("challenge",)}),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.findings == ()
    assert states(result) == {
        "headers": ("skipped", "challenge_response"),
        "cookies": ("skipped", "challenge_response"),
        "cors": ("skipped", "challenge_response"),
        "redirect": ("ran", None),
        "tls": ("ran", None),
        "edge": ("ran", None),
        "exposed_files": ("skipped", "not_enabled"),
    }


def test_a_confirmed_challenge_on_the_http_response_skips_only_the_redirect_check() -> None:
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS),
        reply("http://example.com/", 403, {"cf-mitigated": ("challenge",)}),
    )

    result = executor(client).execute("https://example.com")

    assert states(result)["redirect"] == ("skipped", "challenge_response")
    assert states(result)["headers"] == ("ran", None)


def test_a_possible_challenge_keeps_findings_with_low_confidence() -> None:
    client = FakeClient(reply("https://example.com/", 403), reply("http://example.com/", 301))

    result = executor(client).execute("https://example.com")

    assert result.findings
    assert all(finding.confidence is FindingConfidence.LOW for finding in result.findings)
    assert all(finding.evidence["possible_challenge"] is True for finding in result.findings)
    assert states(result)["headers"] == ("ran", None)


def test_the_request_budget_rejects_a_third_request() -> None:
    budget = RequestBudget(2)
    budget.consume()
    budget.consume()

    with pytest.raises(RequestBudgetExceededError):
        budget.consume()


def test_sub_check_states_use_the_documented_enum() -> None:
    assert {state.value for state in SubCheckState} == {"ran", "skipped"}


def test_a_successful_scan_returns_the_edge_profile_from_both_responses() -> None:
    client = FakeClient(
        reply("https://example.com/", headers={**GOOD_HTTPS_HEADERS, "cf-ray": ("8c1-AMS",)}),
        reply("http://example.com/", 301, {"x-vercel-id": ("iad1::a",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.edge_profile is not None
    assert [(item.vendor, item.layer.value) for item in result.edge_profile.detections] == [
        ("CLOUDFLARE", "CDN"),
        ("VERCEL", "CDN"),
    ]
    assert result.edge_profile.challenge_observed is False
    assert states(result)["edge"] == ("ran", None)


def test_an_unknown_site_gets_an_empty_profile_not_none() -> None:
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.edge_profile is not None
    assert result.edge_profile.detections == ()


def test_a_confirmed_vendor_challenge_is_recorded_in_the_profile() -> None:
    client = FakeClient(
        reply("https://example.com/", 202, {"x-amzn-waf-action": ("challenge",)}),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.edge_profile is not None
    assert result.edge_profile.challenge_observed is True
    assert states(result)["headers"] == ("skipped", "challenge_response")


def test_an_anti_bot_cookie_on_a_403_suppresses_posture_findings() -> None:
    client = FakeClient(
        reply("https://example.com/", 403, cookies=(CookieInfo(name="datadome"),)),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.findings == ()
    assert states(result)["cookies"] == ("skipped", "challenge_response")
    assert result.edge_profile is not None
    assert result.edge_profile.challenge_observed is True


def test_the_edge_check_is_skipped_without_a_response_and_leaves_no_profile() -> None:
    client = FakeClient(PostureConnectionError("down"), PostureConnectionError("down"))

    result = executor(client).execute("https://example.com")

    assert result.edge_profile is None
    assert states(result)["edge"] == ("skipped", "connection_failed")


def test_an_edge_failure_never_fails_the_scan(monkeypatch) -> None:
    from ontapulse_worker.modules.security_posture.application import posture_scan

    def broken(_data):
        raise RuntimeError("bug")

    monkeypatch.setattr(posture_scan, "detect_edge", broken)
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = executor(client).execute("https://example.com")

    assert result.edge_profile is None
    assert states(result)["edge"] == ("skipped", "prerequisite_failed")
    assert states(result)["headers"] == ("ran", None)


def test_the_edge_check_adds_no_request_or_handshake() -> None:
    tls = FakeTls()
    client = FakeClient(reply("https://example.com/"), reply("http://example.com/", 301))

    executor(client, tls).execute("https://example.com")

    assert len(client.urls) == 2
    assert len(tls.calls) == 1

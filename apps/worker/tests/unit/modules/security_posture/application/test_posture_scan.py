import pytest

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import FindingConfidence, SubCheckState
from ontapulse_worker.modules.security_posture.application.ports import PostureConnectionError
from ontapulse_worker.modules.security_posture.application.posture_scan import (
    PostureScanExecutor,
    RequestBudget,
    RequestBudgetExceededError,
)
from ontapulse_worker.modules.security_posture.domain.models import CookieInfo, PostureResponse

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

    result = PostureScanExecutor(client).execute("https://example.com")

    assert result.findings == ()
    assert result.status_code == 200
    assert result.response_time_ms == 30
    assert states(result) == {
        "headers": ("ran", None),
        "cookies": ("ran", None),
        "cors": ("ran", None),
        "redirect": ("ran", None),
    }


def test_a_scan_makes_exactly_two_requests_to_the_derived_urls() -> None:
    client = FakeClient(reply("https://example.com/a"), reply("http://example.com/a", 301))

    PostureScanExecutor(client).execute("http://example.com/a?x=1")

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

    ids = {
        finding.check_id
        for finding in PostureScanExecutor(client).execute("https://example.com").findings
    }

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

    result = PostureScanExecutor(client).execute("https://example.com")

    assert states(result)["redirect"] == ("skipped", "connection_failed")
    assert states(result)["headers"] == ("ran", None)
    assert result.findings == ()


def test_a_failed_https_request_skips_header_cookie_and_cors_checks() -> None:
    client = FakeClient(PostureConnectionError(), reply("http://example.com/", 301))

    result = PostureScanExecutor(client).execute("https://example.com")

    assert result.status_code is None
    assert states(result) == {
        "headers": ("skipped", "connection_failed"),
        "cookies": ("skipped", "connection_failed"),
        "cors": ("skipped", "connection_failed"),
        "redirect": ("ran", None),
    }


def test_the_scan_fails_when_neither_request_can_connect() -> None:
    client = FakeClient(PostureConnectionError(), PostureConnectionError())

    with pytest.raises(ScanExecutionError, match="unavailable"):
        PostureScanExecutor(client).execute("https://example.com")

    assert len(client.urls) == 2


def test_a_rejected_target_fails_the_scan_before_the_second_request() -> None:
    client = FakeClient(ScanExecutionError("Scan target is not publicly reachable"), None)

    with pytest.raises(ScanExecutionError, match="not publicly reachable"):
        PostureScanExecutor(client).execute("https://example.com")

    assert client.urls == ["https://example.com/"]


def test_a_confirmed_challenge_suppresses_the_findings_of_that_response() -> None:
    client = FakeClient(
        reply("https://example.com/", 403, {"cf-mitigated": ("challenge",)}),
        reply("http://example.com/", 301, {"location": ("https://example.com/",)}),
    )

    result = PostureScanExecutor(client).execute("https://example.com")

    assert result.findings == ()
    assert states(result) == {
        "headers": ("skipped", "challenge_response"),
        "cookies": ("skipped", "challenge_response"),
        "cors": ("skipped", "challenge_response"),
        "redirect": ("ran", None),
    }


def test_a_confirmed_challenge_on_the_http_response_skips_only_the_redirect_check() -> None:
    client = FakeClient(
        reply("https://example.com/", headers=GOOD_HTTPS_HEADERS),
        reply("http://example.com/", 403, {"cf-mitigated": ("challenge",)}),
    )

    result = PostureScanExecutor(client).execute("https://example.com")

    assert states(result)["redirect"] == ("skipped", "challenge_response")
    assert states(result)["headers"] == ("ran", None)


def test_a_possible_challenge_keeps_findings_with_low_confidence() -> None:
    client = FakeClient(reply("https://example.com/", 403), reply("http://example.com/", 301))

    result = PostureScanExecutor(client).execute("https://example.com")

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

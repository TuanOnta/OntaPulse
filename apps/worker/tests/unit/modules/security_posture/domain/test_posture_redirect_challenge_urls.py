import pytest
from posture_fixtures import HTTP_URL, check_ids, response

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import FindingConfidence
from ontapulse_worker.modules.security_posture.domain.catalog import make_finding
from ontapulse_worker.modules.security_posture.domain.challenge import (
    ChallengeKind,
    classify_challenge,
    mark_possible_challenge,
)
from ontapulse_worker.modules.security_posture.domain.redirect_rules import (
    evaluate_redirect,
    location_for_evidence,
)
from ontapulse_worker.modules.security_posture.domain.urls import derive_posture_urls


def http_response(status: int, location: str | None = None):
    headers = {"location": (location,)} if location is not None else {}

    return response(headers, status_code=status, url=HTTP_URL)


@pytest.mark.parametrize(
    ("status", "location", "expected"),
    [
        (301, "https://example.com/", []),
        (308, "https://example.com/", []),
        (302, "https://example.com/", ["SEC_REDIRECT_NOT_PERMANENT"]),
        (307, "https://example.com/", ["SEC_REDIRECT_NOT_PERMANENT"]),
        (301, "http://example.com/login", ["SEC_REDIRECT_TO_HTTP"]),
        (301, "/login", ["SEC_REDIRECT_TO_HTTP"]),
        (301, "https://www.example.com/", ["SEC_REDIRECT_OFF_HOST"]),
        (
            302,
            "https://other.example.net/",
            ["SEC_REDIRECT_NOT_PERMANENT", "SEC_REDIRECT_OFF_HOST"],
        ),
        (301, None, []),
        (200, None, ["SEC_REDIRECT_NO_HTTPS"]),
        (204, None, ["SEC_REDIRECT_NO_HTTPS"]),
        (404, None, []),
        (503, None, []),
    ],
)
def test_redirect_rules(status: int, location: str | None, expected: list[str]) -> None:
    assert check_ids(evaluate_redirect(http_response(status, location))) == sorted(expected)


def test_redirect_evidence_drops_the_query_string_and_is_bounded() -> None:
    (finding,) = evaluate_redirect(http_response(301, "http://example.com/cb?token=SECRET#frag"))

    assert finding.evidence["location"] == "http://example.com/cb"
    assert "SECRET" not in str(finding.evidence)
    assert len(location_for_evidence("https://example.com/" + "a" * 1_000)) <= 512


@pytest.mark.parametrize(
    ("headers", "status", "expected"),
    [
        ({"cf-mitigated": ("challenge",)}, 403, ChallengeKind.CONFIRMED),
        ({"cf-mitigated": (" Challenge ",)}, 200, ChallengeKind.CONFIRMED),
        ({"cf-mitigated": ("other",)}, 200, ChallengeKind.NONE),
        ({}, 403, ChallengeKind.POSSIBLE),
        ({}, 429, ChallengeKind.POSSIBLE),
        ({}, 503, ChallengeKind.POSSIBLE),
        ({}, 200, ChallengeKind.NONE),
        ({}, 404, ChallengeKind.NONE),
    ],
)
def test_challenge_classification(headers, status: int, expected: ChallengeKind) -> None:
    assert classify_challenge(response(headers, status_code=status)) is expected


def test_possible_challenge_lowers_confidence_and_flags_the_evidence() -> None:
    finding = make_finding("SEC_HDR_CSP_MISSING", {"header": "content-security-policy"})

    (marked,) = mark_possible_challenge([finding])

    assert marked.confidence is FindingConfidence.LOW
    assert marked.evidence == {"header": "content-security-policy", "possible_challenge": True}
    assert finding.confidence is None


@pytest.mark.parametrize(
    ("target", "https_url", "http_url"),
    [
        ("https://example.com", "https://example.com/", "http://example.com/"),
        ("http://example.com", "https://example.com/", "http://example.com/"),
        (
            "https://example.com/a/b?x=1#frag",
            "https://example.com/a/b?x=1",
            "http://example.com/a/b?x=1",
        ),
        ("http://example.com/p", "https://example.com/p", "http://example.com/p"),
        ("https://example.com:8443/p", "https://example.com:8443/p", "http://example.com/p"),
        ("http://example.com:8080/p", "https://example.com/p", "http://example.com:8080/p"),
        ("https://[2001:db8::1]/x", "https://[2001:db8::1]/x", "http://[2001:db8::1]/x"),
    ],
)
def test_url_derivation(target: str, https_url: str, http_url: str) -> None:
    assert derive_posture_urls(target) == (https_url, http_url)


@pytest.mark.parametrize(
    "target",
    [
        "ftp://example.com",
        "https://user:pw@example.com",
        "example.com",
        "https://",
        "https://a:99999",
    ],
)
def test_url_derivation_rejects_invalid_targets(target: str) -> None:
    with pytest.raises(ScanExecutionError, match="invalid"):
        derive_posture_urls(target)

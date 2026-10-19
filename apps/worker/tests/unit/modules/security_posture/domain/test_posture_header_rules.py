import pytest
from posture_fixtures import check_ids, response, with_header, without

from ontapulse_worker.modules.scans.domain.models import FindingConfidence
from ontapulse_worker.modules.security_posture.domain.header_rules import (
    evaluate_headers,
    parse_hsts,
)

GOOD_FRAME = {
    **without("content-security-policy"),
    "content-security-policy": ("default-src 'self'; frame-ancestors 'self'",),
}


def test_a_well_configured_response_has_no_header_finding() -> None:
    assert evaluate_headers(response()) == []


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("max-age=31536000; includeSubDomains", []),
        ("max-age=31536000; includeSubDomains; preload", []),
        ('max-age="31536000"; includeSubDomains', []),
        ("MAX-AGE=31536000; INCLUDESUBDOMAINS", []),
        ("max-age=31536000", ["SEC_HDR_HSTS_NO_SUBDOMAINS"]),
        ("max-age=3600; includeSubDomains", ["SEC_HDR_HSTS_SHORT_MAX_AGE"]),
        (
            "max-age=3600",
            ["SEC_HDR_HSTS_NO_SUBDOMAINS", "SEC_HDR_HSTS_SHORT_MAX_AGE"],
        ),
        ("max-age=15552000; includeSubDomains", []),
        ("max-age=15551999; includeSubDomains", ["SEC_HDR_HSTS_SHORT_MAX_AGE"]),
        ("max-age=0", ["SEC_HDR_HSTS_DISABLED"]),
        ("max-age=0; includeSubDomains", ["SEC_HDR_HSTS_DISABLED"]),
        ("includeSubDomains", ["SEC_HDR_HSTS_INVALID"]),
        ("max-age=abc", ["SEC_HDR_HSTS_INVALID"]),
        ("max-age=31536000; max-age=10", ["SEC_HDR_HSTS_INVALID"]),
        ("max-age=31536000; includeSubDomains; includeSubDomains", ["SEC_HDR_HSTS_INVALID"]),
        ("", ["SEC_HDR_HSTS_INVALID"]),
        ("max-age=-5", ["SEC_HDR_HSTS_INVALID"]),
    ],
)
def test_hsts_rules(value: str, expected: list[str]) -> None:
    findings = evaluate_headers(response(with_header("strict-transport-security", value)))

    assert check_ids(findings) == sorted(expected)


def test_missing_hsts_is_reported() -> None:
    findings = evaluate_headers(response(without("strict-transport-security")))

    assert check_ids(findings) == ["SEC_HDR_HSTS_MISSING"]


def test_only_the_first_hsts_header_counts() -> None:
    headers = with_header(
        "strict-transport-security", "max-age=31536000; includeSubDomains", "max-age=0"
    )

    assert evaluate_headers(response(headers)) == []


def test_hsts_parser_returns_none_for_an_invalid_header() -> None:
    assert parse_hsts("nonsense;;") is None


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        (
            without("content-security-policy"),
            ["SEC_HDR_CSP_MISSING", "SEC_HDR_FRAME_PROTECTION_MISSING"],
        ),
        (
            {
                **without("content-security-policy"),
                "content-security-policy-report-only": ("default-src 'self'",),
            },
            ["SEC_HDR_CSP_REPORT_ONLY", "SEC_HDR_FRAME_PROTECTION_MISSING"],
        ),
        (
            with_header(
                "content-security-policy",
                "script-src 'self' 'unsafe-inline'; frame-ancestors 'self'",
            ),
            ["SEC_HDR_CSP_UNSAFE_INLINE"],
        ),
        (
            with_header(
                "content-security-policy",
                "script-src 'self' 'unsafe-inline' 'nonce-abc123'; frame-ancestors 'self'",
            ),
            [],
        ),
        (
            with_header(
                "content-security-policy",
                "script-src 'unsafe-inline' 'sha256-AbCd'; frame-ancestors 'self'",
            ),
            [],
        ),
        (
            with_header(
                "content-security-policy",
                "script-src 'unsafe-inline' 'strict-dynamic'; frame-ancestors 'self'",
            ),
            [],
        ),
        (
            with_header(
                "content-security-policy",
                "default-src 'self' 'unsafe-eval'; frame-ancestors 'self'",
            ),
            ["SEC_HDR_CSP_UNSAFE_EVAL"],
        ),
        (
            with_header(
                "content-security-policy", "script-src 'self' data:; frame-ancestors 'self'"
            ),
            ["SEC_HDR_CSP_DATA_SOURCE"],
        ),
        (
            # script-src wins over a permissive default-src.
            with_header(
                "content-security-policy",
                "default-src 'unsafe-inline'; script-src 'self'; frame-ancestors 'self'",
            ),
            [],
        ),
        (
            # A repeated directive keeps the first copy.
            with_header(
                "content-security-policy",
                "script-src 'self'; script-src 'unsafe-inline'; frame-ancestors 'self'",
            ),
            [],
        ),
        (
            # Two policies must both allow it, so a strict second policy removes the weakness.
            with_header(
                "content-security-policy",
                "script-src 'unsafe-inline', script-src 'self'; frame-ancestors 'self'",
            ),
            [],
        ),
        (
            with_header("content-security-policy", "img-src 'self'; frame-ancestors 'none'"),
            [],
        ),
    ],
)
def test_csp_rules(headers, expected: list[str]) -> None:
    assert check_ids(evaluate_headers(response(headers))) == sorted(expected)


def test_unsafe_inline_is_reported_with_low_confidence_and_nonces_are_redacted() -> None:
    policy = (
        "script-src 'unsafe-inline' https://a.example; "
        "style-src 'nonce-SECRETNONCE'; frame-ancestors 'self'"
    )

    (finding,) = evaluate_headers(response(with_header("content-security-policy", policy)))

    assert finding.check_id == "SEC_HDR_CSP_UNSAFE_INLINE"
    assert finding.confidence is FindingConfidence.LOW
    assert "SECRETNONCE" not in str(finding.evidence)
    assert "'nonce-<redacted>'" in str(finding.evidence)


def test_csp_evidence_is_bounded() -> None:
    policy = "script-src 'unsafe-inline' " + "https://a.example " * 400 + "; frame-ancestors 'self'"

    (finding,) = evaluate_headers(response(with_header("content-security-policy", policy)))

    assert len(str(finding.evidence["policy"])) <= 2_048


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        (
            without("content-security-policy"),
            ["SEC_HDR_CSP_MISSING", "SEC_HDR_FRAME_PROTECTION_MISSING"],
        ),
        (
            {**without("content-security-policy"), "x-frame-options": ("DENY",)},
            ["SEC_HDR_CSP_MISSING"],
        ),
        (
            {**without("content-security-policy"), "x-frame-options": ("sameorigin",)},
            ["SEC_HDR_CSP_MISSING"],
        ),
        (
            {
                **without("content-security-policy"),
                "x-frame-options": ("ALLOW-FROM https://a.example",),
            },
            ["SEC_HDR_CSP_MISSING", "SEC_HDR_XFO_INVALID"],
        ),
        (
            # frame-ancestors makes an invalid X-Frame-Options irrelevant.
            {**GOOD_FRAME, "x-frame-options": ("ALLOW-FROM https://a.example",)},
            [],
        ),
    ],
)
def test_frame_protection_rules(headers, expected: list[str]) -> None:
    assert check_ids(evaluate_headers(response(headers))) == sorted(expected)


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        (without("x-content-type-options"), ["SEC_HDR_XCTO_MISSING"]),
        (with_header("x-content-type-options", "sniff"), ["SEC_HDR_XCTO_MISSING"]),
        (with_header("x-content-type-options", "NoSniff"), []),
        (with_header("x-content-type-options", "nosniff, nosniff"), []),
        (without("referrer-policy"), ["SEC_HDR_REFERRER_POLICY_MISSING"]),
        (without("permissions-policy"), ["SEC_HDR_PERMISSIONS_POLICY_MISSING"]),
    ],
)
def test_simple_header_rules(headers, expected: list[str]) -> None:
    assert check_ids(evaluate_headers(response(headers))) == sorted(expected)


def test_findings_carry_catalog_fields() -> None:
    (finding,) = evaluate_headers(response(without("referrer-policy")))

    assert finding.code == finding.check_id == "SEC_HDR_REFERRER_POLICY_MISSING"
    assert finding.category.value == "HEADERS"
    assert finding.severity.value == "LOW"
    assert finding.recommendation
    assert finding.confidence is None

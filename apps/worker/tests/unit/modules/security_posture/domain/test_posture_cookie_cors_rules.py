import pytest
from posture_fixtures import check_ids, response, with_header

from ontapulse_worker.modules.scans.domain.models import FindingConfidence
from ontapulse_worker.modules.security_posture.domain.cookie_rules import (
    evaluate_cookies,
    parse_set_cookie,
)
from ontapulse_worker.modules.security_posture.domain.cors_rules import evaluate_cors


def cookies(*raw: str):
    return tuple(parse_set_cookie(item) for item in raw)


def test_cookie_parsing_keeps_the_name_and_flags_but_never_the_value() -> None:
    cookie = parse_set_cookie(
        "sid=SUPER-SECRET-VALUE; Path=/; Domain=example.com; Secure; HttpOnly; SameSite=Lax"
    )

    assert cookie is not None
    assert cookie.name == "sid"
    assert (cookie.secure, cookie.http_only, cookie.same_site) == (True, True, "lax")
    assert cookie.path == "/"
    assert cookie.has_domain
    assert "SUPER-SECRET-VALUE" not in repr(cookie)


@pytest.mark.parametrize("raw", ["", "novalue", "=x", "  =x; Secure"])
def test_malformed_set_cookie_headers_are_ignored(raw: str) -> None:
    assert parse_set_cookie(raw) is None


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("a=1; Secure; HttpOnly; SameSite=Lax", []),
        ("a=1; HttpOnly; SameSite=Lax", ["SEC_COOKIE_NO_SECURE"]),
        ("a=1; Secure; SameSite=Lax", ["SEC_COOKIE_NO_HTTPONLY"]),
        ("a=1; Secure; HttpOnly", ["SEC_COOKIE_NO_SAMESITE"]),
        (
            "a=1; HttpOnly; SameSite=None",
            ["SEC_COOKIE_NO_SECURE", "SEC_COOKIE_SAMESITE_NONE_INSECURE"],
        ),
        ("a=1; Secure; HttpOnly; SameSite=None", []),
        (
            "__Secure-a=1; HttpOnly; SameSite=Lax",
            ["SEC_COOKIE_NO_SECURE", "SEC_COOKIE_PREFIX_VIOLATION"],
        ),
        ("__Host-a=1; Secure; HttpOnly; SameSite=Lax; Path=/", []),
        (
            "__Host-a=1; Secure; HttpOnly; SameSite=Lax; Path=/app",
            ["SEC_COOKIE_PREFIX_VIOLATION"],
        ),
        (
            "__Host-a=1; Secure; HttpOnly; SameSite=Lax; Path=/; Domain=example.com",
            ["SEC_COOKIE_PREFIX_VIOLATION"],
        ),
        (
            "a=1",
            ["SEC_COOKIE_NO_HTTPONLY", "SEC_COOKIE_NO_SAMESITE", "SEC_COOKIE_NO_SECURE"],
        ),
    ],
)
def test_cookie_rules(raw: str, expected: list[str]) -> None:
    assert check_ids(evaluate_cookies(cookies(raw))) == sorted(expected)


def test_session_like_cookie_names_raise_the_httponly_confidence() -> None:
    plain = evaluate_cookies(cookies("theme=1; Secure; SameSite=Lax"))
    session = evaluate_cookies(cookies("session_id=1; Secure; SameSite=Lax"))

    assert plain[0].confidence is FindingConfidence.LOW
    assert session[0].confidence is FindingConfidence.MEDIUM


def test_cookie_findings_list_names_only_and_are_bounded() -> None:
    raws = [f"cookie{index}=value-{index}" for index in range(30)]

    findings = evaluate_cookies(cookies(*raws))
    evidence = findings[0].evidence

    assert len(evidence["cookies"]) == 20
    assert evidence["count"] == 30
    assert "value-" not in str(findings)


def test_no_cookies_means_no_finding() -> None:
    assert evaluate_cookies(()) == []


@pytest.mark.parametrize(
    ("headers", "expected"),
    [
        ({}, []),
        ({"access-control-allow-origin": ("https://app.example.com",)}, []),
        ({"access-control-allow-origin": ("*",)}, ["SEC_CORS_WILDCARD_ORIGIN"]),
        (
            {
                "access-control-allow-origin": ("*",),
                "access-control-allow-credentials": ("true",),
            },
            ["SEC_CORS_WILDCARD_ORIGIN", "SEC_CORS_WILDCARD_WITH_CREDENTIALS"],
        ),
        (
            # The only valid value is the case-sensitive "true".
            {
                "access-control-allow-origin": ("*",),
                "access-control-allow-credentials": ("True",),
            },
            ["SEC_CORS_WILDCARD_ORIGIN"],
        ),
        ({"access-control-allow-origin": ("null",)}, ["SEC_CORS_NULL_ORIGIN"]),
        (
            {
                "access-control-allow-origin": ("https://a.example",),
                "access-control-allow-credentials": ("true",),
            },
            [],
        ),
    ],
)
def test_cors_rules(headers, expected: list[str]) -> None:
    assert check_ids(evaluate_cors(response(headers))) == sorted(expected)


def test_cors_wildcard_confidence_is_low_without_credentials() -> None:
    (finding,) = evaluate_cors(response(with_header("access-control-allow-origin", "*")))

    assert finding.confidence is FindingConfidence.LOW

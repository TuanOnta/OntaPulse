"""Shared builders for posture evaluator tests."""

from ontapulse_worker.modules.security_posture.domain.models import CookieInfo, PostureResponse

HTTPS_URL = "https://example.com/"
HTTP_URL = "http://example.com/"

# A well configured response: no header, cookie, or CORS finding is expected.
GOOD_HEADERS: dict[str, tuple[str, ...]] = {
    "strict-transport-security": ("max-age=31536000; includeSubDomains",),
    "content-security-policy": ("default-src 'self'; frame-ancestors 'none'",),
    "x-content-type-options": ("nosniff",),
    "referrer-policy": ("strict-origin-when-cross-origin",),
    "permissions-policy": ("geolocation=()",),
}


def response(
    headers: dict[str, tuple[str, ...]] | None = None,
    *,
    status_code: int = 200,
    url: str = HTTPS_URL,
    cookies: tuple[CookieInfo, ...] = (),
) -> PostureResponse:
    return PostureResponse(
        url=url,
        status_code=status_code,
        headers=GOOD_HEADERS if headers is None else headers,
        cookies=cookies,
        elapsed_ms=12,
    )


def without(*names: str) -> dict[str, tuple[str, ...]]:
    return {name: value for name, value in GOOD_HEADERS.items() if name not in names}


def with_header(name: str, *values: str) -> dict[str, tuple[str, ...]]:
    return {**GOOD_HEADERS, name: values}


def check_ids(findings) -> list[str]:
    return sorted(finding.check_id for finding in findings)

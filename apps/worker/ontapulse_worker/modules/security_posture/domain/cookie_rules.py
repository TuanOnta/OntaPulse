"""Pure evaluation of cookie attributes (names and flags only).

Secure and HttpOnly per RFC 6265; SameSite and the __Secure- / __Host- prefixes per the
current rfc6265bis Internet-Draft. See docs/security-checks.md section 6.2.
"""

from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import (
    MAX_COOKIE_NAME_CHARS,
    MAX_COOKIES_IN_EVIDENCE,
    SESSION_COOKIE_NAME_HINTS,
    make_finding,
)
from ontapulse_worker.modules.security_posture.domain.models import CookieInfo


def parse_set_cookie(header_value: str) -> CookieInfo | None:
    """Keep the name and attribute flags of one Set-Cookie value. The value is dropped."""
    name_value, *attributes = header_value.split(";")
    name, separator, _value = name_value.partition("=")
    name = name.strip()

    if not separator or not name:
        return None

    secure = http_only = has_domain = False
    same_site: str | None = None
    path: str | None = None

    for attribute in attributes:
        attribute_name, _, attribute_value = attribute.partition("=")
        key = attribute_name.strip().lower()
        attribute_value = attribute_value.strip()

        if key == "secure":
            secure = True
        elif key == "httponly":
            http_only = True
        elif key == "domain":
            has_domain = True
        elif key == "samesite":
            same_site = attribute_value.lower()
        elif key == "path":
            path = attribute_value

    return CookieInfo(
        name=name[:MAX_COOKIE_NAME_CHARS],
        secure=secure,
        http_only=http_only,
        same_site=same_site,
        path=path,
        has_domain=has_domain,
    )


def _looks_like_session(name: str) -> bool:
    lowered = name.lower()

    return any(hint in lowered for hint in SESSION_COOKIE_NAME_HINTS)


def _evidence(cookies: list[CookieInfo], missing: str) -> dict[str, object]:
    return {
        "cookies": [cookie.name for cookie in cookies[:MAX_COOKIES_IN_EVIDENCE]],
        "count": len(cookies),
        "missing": missing,
    }


def evaluate_cookies(cookies: tuple[CookieInfo, ...]) -> list[ScanFinding]:
    findings: list[ScanFinding] = []

    no_secure = [cookie for cookie in cookies if not cookie.secure]
    no_http_only = [cookie for cookie in cookies if not cookie.http_only]
    no_same_site = [cookie for cookie in cookies if cookie.same_site is None]
    none_insecure = [
        cookie for cookie in cookies if cookie.same_site == "none" and not cookie.secure
    ]
    prefix_violations = [cookie for cookie in cookies if _violates_prefix(cookie)]

    if no_secure:
        findings.append(make_finding("SEC_COOKIE_NO_SECURE", _evidence(no_secure, "Secure")))

    if no_http_only:
        confidence = (
            FindingConfidence.MEDIUM
            if any(_looks_like_session(cookie.name) for cookie in no_http_only)
            else FindingConfidence.LOW
        )
        findings.append(
            make_finding("SEC_COOKIE_NO_HTTPONLY", _evidence(no_http_only, "HttpOnly"), confidence)
        )

    if no_same_site:
        findings.append(
            make_finding(
                "SEC_COOKIE_NO_SAMESITE",
                _evidence(no_same_site, "SameSite"),
                FindingConfidence.LOW,
            )
        )

    if none_insecure:
        findings.append(
            make_finding("SEC_COOKIE_SAMESITE_NONE_INSECURE", _evidence(none_insecure, "Secure"))
        )

    if prefix_violations:
        findings.append(
            make_finding(
                "SEC_COOKIE_PREFIX_VIOLATION", _evidence(prefix_violations, "prefix rules")
            )
        )

    return findings


def _violates_prefix(cookie: CookieInfo) -> bool:
    lowered = cookie.name.lower()

    if lowered.startswith("__secure-"):
        return not cookie.secure

    if lowered.startswith("__host-"):
        return not cookie.secure or cookie.path != "/" or cookie.has_domain

    return False

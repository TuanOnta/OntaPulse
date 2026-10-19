"""Pure evaluation of security response headers.

Semantics: HSTS per RFC 6797, CSP per W3C CSP Level 3 (syntax and default-src fallback),
X-Frame-Options and X-Content-Type-Options per MDN, Referrer-Policy and Permissions-Policy
presence only. See docs/security-checks.md section 6.1.
"""

import re
from dataclasses import dataclass

from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import (
    HSTS_MIN_MAX_AGE_SECONDS,
    MAX_CSP_EVIDENCE_CHARS,
    make_finding,
)
from ontapulse_worker.modules.security_posture.domain.models import PostureResponse

TOKEN = re.compile(r"^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$")
QUOTED = re.compile(r'^"(?:[^"\\]|\\.)*"$')
DIGITS = re.compile(r"^[0-9]+$")
NONCE_REDACTION = re.compile(r"'nonce-[^']*'", re.IGNORECASE)
HASH_PREFIXES = ("'sha256-", "'sha384-", "'sha512-")
VALID_XFO_VALUES = frozenset({"DENY", "SAMEORIGIN"})


def evaluate_headers(response: PostureResponse) -> list[ScanFinding]:
    findings: list[ScanFinding] = []
    findings.extend(_evaluate_hsts(response))

    csp_findings, has_frame_ancestors = _evaluate_csp(response)
    findings.extend(csp_findings)
    findings.extend(_evaluate_frame_protection(response, has_frame_ancestors))

    value = response.header("x-content-type-options")
    first_token = value.split(",", maxsplit=1)[0].strip().lower() if value else None

    if first_token != "nosniff":
        findings.append(
            make_finding(
                "SEC_HDR_XCTO_MISSING",
                {"header": "x-content-type-options", "present": value is not None},
            )
        )

    if response.header("referrer-policy") is None:
        findings.append(
            make_finding("SEC_HDR_REFERRER_POLICY_MISSING", {"header": "referrer-policy"})
        )

    if response.header("permissions-policy") is None:
        findings.append(
            make_finding("SEC_HDR_PERMISSIONS_POLICY_MISSING", {"header": "permissions-policy"})
        )

    return findings


@dataclass(frozen=True)
class _Hsts:
    max_age: int | None
    include_subdomains: bool


def parse_hsts(value: str) -> _Hsts | None:
    """Return the parsed policy, or None when the header is invalid per RFC 6797."""
    seen: set[str] = set()
    max_age: int | None = None
    include_subdomains = False

    for raw_directive in value.split(";"):
        directive = raw_directive.strip()

        if not directive:
            continue

        name, separator, raw_value = directive.partition("=")
        name = name.strip().lower()
        raw_value = raw_value.strip()

        if not TOKEN.match(name) or name in seen:
            return None

        seen.add(name)

        if separator and not (TOKEN.match(raw_value) or QUOTED.match(raw_value)):
            return None

        if name == "max-age":
            digits = raw_value[1:-1] if QUOTED.match(raw_value) else raw_value

            if not DIGITS.match(digits):
                return None

            max_age = int(digits)
        elif name == "includesubdomains":
            include_subdomains = True

    if max_age is None:
        return None

    return _Hsts(max_age=max_age, include_subdomains=include_subdomains)


def _evaluate_hsts(response: PostureResponse) -> list[ScanFinding]:
    # Only the first Strict-Transport-Security header counts (RFC 6797 section 8.1).
    value = response.header("strict-transport-security")

    if value is None:
        return [make_finding("SEC_HDR_HSTS_MISSING", {"header": "strict-transport-security"})]

    policy = parse_hsts(value)

    if policy is None or policy.max_age is None:
        return [make_finding("SEC_HDR_HSTS_INVALID", {"header": "strict-transport-security"})]

    if policy.max_age == 0:
        return [make_finding("SEC_HDR_HSTS_DISABLED", {"maxAge": 0})]

    findings: list[ScanFinding] = []

    if policy.max_age < HSTS_MIN_MAX_AGE_SECONDS:
        findings.append(
            make_finding(
                "SEC_HDR_HSTS_SHORT_MAX_AGE",
                {"maxAge": policy.max_age, "minimum": HSTS_MIN_MAX_AGE_SECONDS},
            )
        )

    if not policy.include_subdomains:
        findings.append(
            make_finding(
                "SEC_HDR_HSTS_NO_SUBDOMAINS",
                {"maxAge": policy.max_age},
                confidence=FindingConfidence.LOW,
            )
        )

    return findings


def parse_csp_policy(policy: str) -> dict[str, tuple[str, ...]]:
    """Parse one policy into directives; a repeated directive keeps its first copy."""
    directives: dict[str, tuple[str, ...]] = {}

    for raw_directive in policy.split(";"):
        parts = raw_directive.split()

        if not parts:
            continue

        name = parts[0].lower()

        if name not in directives:
            directives[name] = tuple(part.lower() for part in parts[1:])

    return directives


def _redact_csp(policy: str) -> str:
    return NONCE_REDACTION.sub("'nonce-<redacted>'", policy)[:MAX_CSP_EVIDENCE_CHARS]


def _split_policies(values: tuple[str, ...]) -> list[str]:
    return [policy for value in values for policy in value.split(",") if policy.strip()]


def _evaluate_csp(response: PostureResponse) -> tuple[list[ScanFinding], bool]:
    enforcing = _split_policies(response.headers.get("content-security-policy", ()))
    report_only = response.headers.get("content-security-policy-report-only", ())

    if not enforcing:
        check_id = "SEC_HDR_CSP_REPORT_ONLY" if report_only else "SEC_HDR_CSP_MISSING"

        return [make_finding(check_id, {"header": "content-security-policy"})], False

    parsed = [parse_csp_policy(policy) for policy in enforcing]
    has_frame_ancestors = any("frame-ancestors" in directives for directives in parsed)
    findings: list[ScanFinding] = []

    # Several policies must all allow a resource, so a weakness counts only when every
    # policy has it.
    script_sources = [
        directives.get("script-src", directives.get("default-src")) for directives in parsed
    ]

    if all(sources is not None for sources in script_sources):
        sources_list = [sources for sources in script_sources if sources is not None]
        evidence = {"policy": _redact_csp(enforcing[0])}

        if all(_allows_unsafe_inline(sources) for sources in sources_list):
            findings.append(
                make_finding(
                    "SEC_HDR_CSP_UNSAFE_INLINE", evidence, confidence=FindingConfidence.LOW
                )
            )

        if all("'unsafe-eval'" in sources for sources in sources_list):
            findings.append(make_finding("SEC_HDR_CSP_UNSAFE_EVAL", evidence))

        if all("data:" in sources for sources in sources_list):
            findings.append(make_finding("SEC_HDR_CSP_DATA_SOURCE", evidence))

    return findings, has_frame_ancestors


def _allows_unsafe_inline(sources: tuple[str, ...]) -> bool:
    if "'unsafe-inline'" not in sources:
        return False

    # The CSP3 text read does not say when 'unsafe-inline' is ignored, so stay conservative.
    for source in sources:
        if source.startswith("'nonce-") or source == "'strict-dynamic'":
            return False

        if source.startswith(HASH_PREFIXES):
            return False

    return True


def _evaluate_frame_protection(
    response: PostureResponse,
    has_frame_ancestors: bool,
) -> list[ScanFinding]:
    value = response.header("x-frame-options")

    if has_frame_ancestors:
        return []

    if value is None:
        return [
            make_finding(
                "SEC_HDR_FRAME_PROTECTION_MISSING",
                {"headers": ["x-frame-options", "content-security-policy"]},
            )
        ]

    if value.strip().upper() not in VALID_XFO_VALUES:
        return [make_finding("SEC_HDR_XFO_INVALID", {"header": "x-frame-options"})]

    return []

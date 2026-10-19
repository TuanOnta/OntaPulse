"""Pure evaluation of CORS response headers (no Origin request header is sent).

Semantics: WHATWG Fetch, CORS protocol and credentials. See docs/security-checks.md 6.4.
"""

from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import make_finding
from ontapulse_worker.modules.security_posture.domain.models import PostureResponse


def evaluate_cors(response: PostureResponse) -> list[ScanFinding]:
    allow_origin = response.header("access-control-allow-origin")

    if allow_origin is None:
        return []

    origin = allow_origin.strip()
    # The only valid Access-Control-Allow-Credentials value is the case-sensitive "true".
    credentials = (response.header("access-control-allow-credentials") or "").strip() == "true"
    findings: list[ScanFinding] = []

    if origin == "*":
        findings.append(
            make_finding(
                "SEC_CORS_WILDCARD_ORIGIN",
                {"allowOrigin": "*"},
                FindingConfidence.LOW,
            )
        )

        if credentials:
            findings.append(
                make_finding(
                    "SEC_CORS_WILDCARD_WITH_CREDENTIALS",
                    {"allowOrigin": "*", "allowCredentials": True},
                    FindingConfidence.MEDIUM,
                )
            )

    elif origin == "null":
        findings.append(
            make_finding(
                "SEC_CORS_NULL_ORIGIN",
                {"allowOrigin": "null"},
                FindingConfidence.MEDIUM,
            )
        )

    return findings

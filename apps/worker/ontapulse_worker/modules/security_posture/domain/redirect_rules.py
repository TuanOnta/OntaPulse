"""Pure evaluation of the first response to the plain HTTP request (redirect not followed).

See docs/security-checks.md section 6.3.
"""

from urllib.parse import urljoin, urlsplit

from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import (
    MAX_LOCATION_EVIDENCE_CHARS,
    make_finding,
)
from ontapulse_worker.modules.security_posture.domain.models import PostureResponse

PERMANENT_REDIRECT_STATUSES = frozenset({301, 308})


def location_for_evidence(location: str) -> str:
    """Drop query string and fragment, which may carry tokens, and bound the length."""
    parts = urlsplit(location)

    return parts._replace(query="", fragment="").geturl()[:MAX_LOCATION_EVIDENCE_CHARS]


def evaluate_redirect(response: PostureResponse) -> list[ScanFinding]:
    status = response.status_code

    if 200 <= status <= 299:
        return [make_finding("SEC_REDIRECT_NO_HTTPS", {"status": status})]

    location = response.header("location")

    if not (300 <= status <= 399) or not location:
        return []

    target = urlsplit(urljoin(response.url, location.strip()))
    evidence: dict[str, object] = {
        "status": status,
        "location": location_for_evidence(location.strip()),
    }

    if target.scheme != "https":
        return [make_finding("SEC_REDIRECT_TO_HTTP", evidence)]

    findings: list[ScanFinding] = []

    if status not in PERMANENT_REDIRECT_STATUSES:
        findings.append(make_finding("SEC_REDIRECT_NOT_PERMANENT", evidence, FindingConfidence.LOW))

    request_host = (urlsplit(response.url).hostname or "").lower()

    if (target.hostname or "").lower() != request_host:
        findings.append(make_finding("SEC_REDIRECT_OFF_HOST", evidence, FindingConfidence.LOW))

    return findings

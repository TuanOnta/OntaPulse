"""Pure challenge classification (docs/security-checks.md section 9).

A challenge page's headers do not describe the real site, so derived findings are suppressed
or marked low confidence. Nothing here solves or evades a challenge.
"""

from dataclasses import replace
from enum import StrEnum

from ontapulse_worker.modules.edge_detection.domain.detector import is_confirmed_challenge
from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import CHALLENGE_STATUS_CODES
from ontapulse_worker.modules.security_posture.domain.models import PostureResponse


class ChallengeKind(StrEnum):
    NONE = "none"
    POSSIBLE = "possible"
    CONFIRMED = "confirmed"


def classify_challenge(response: PostureResponse) -> ChallengeKind:
    # Verified vendor markers and anti-bot challenge cookies live with the fingerprints.
    cookie_names = tuple(cookie.name for cookie in response.cookies)

    if is_confirmed_challenge(response.status_code, response.headers, cookie_names):
        return ChallengeKind.CONFIRMED

    if response.status_code in CHALLENGE_STATUS_CODES:
        return ChallengeKind.POSSIBLE

    return ChallengeKind.NONE


def mark_possible_challenge(findings: list[ScanFinding]) -> list[ScanFinding]:
    return [
        replace(
            finding,
            confidence=FindingConfidence.LOW,
            evidence={**(finding.evidence or {}), "possible_challenge": True},
        )
        for finding in findings
    ]

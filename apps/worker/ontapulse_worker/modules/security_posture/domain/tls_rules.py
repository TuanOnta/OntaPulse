"""Pure evaluation of a TLS observation (docs/security-checks.md section 6.5).

The clock is injected as `now`, so expiry logic is testable. Protocol rule: RFC 8996 (TLS 1.0
and 1.1 must not be used).
"""

from datetime import datetime, timedelta

from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import (
    DEPRECATED_TLS_PROTOCOLS,
    MAX_VERIFY_MESSAGE_CHARS,
    TLS_EXPIRY_HIGH_DAYS,
    TLS_EXPIRY_MEDIUM_DAYS,
    VERIFY_CODE_CERT_HAS_EXPIRED,
    VERIFY_CODE_CERT_NOT_YET_VALID,
    VERIFY_CODE_HOSTNAME_MISMATCH,
    make_finding,
)
from ontapulse_worker.modules.security_posture.domain.models import TlsObservation, TlsOutcome


def evaluate_tls(observation: TlsObservation, now: datetime) -> list[ScanFinding]:
    if observation.outcome is TlsOutcome.NO_TLS:
        return [
            make_finding(
                "SEC_TLS_NO_HTTPS",
                {
                    "reason": (observation.error_reason or "handshake_failed")[
                        :MAX_VERIFY_MESSAGE_CHARS
                    ]
                },
                FindingConfidence.MEDIUM,
            )
        ]

    if observation.outcome is TlsOutcome.CERT_VERIFICATION_FAILED:
        return [_verification_failure(observation)]

    findings: list[ScanFinding] = []

    if observation.protocol in DEPRECATED_TLS_PROTOCOLS:
        findings.append(
            make_finding("SEC_TLS_PROTOCOL_DEPRECATED", {"protocol": observation.protocol})
        )

    findings.extend(_validity_findings(observation, now))

    return findings


def _certificate_evidence(observation: TlsObservation, now: datetime) -> dict[str, object]:
    evidence: dict[str, object] = {}

    if observation.subject_cn:
        evidence["subjectCn"] = observation.subject_cn

    if observation.issuer:
        evidence["issuer"] = observation.issuer

    if observation.protocol:
        evidence["protocol"] = observation.protocol

    if observation.not_before:
        evidence["notBefore"] = observation.not_before.isoformat()

    if observation.not_after:
        evidence["notAfter"] = observation.not_after.isoformat()
        evidence["daysRemaining"] = (observation.not_after - now).days

    return evidence


def _validity_findings(observation: TlsObservation, now: datetime) -> list[ScanFinding]:
    evidence = _certificate_evidence(observation, now)

    if observation.not_before is not None and observation.not_before > now:
        return [make_finding("SEC_TLS_CERT_NOT_YET_VALID", evidence)]

    if observation.not_after is None:
        return []

    remaining = observation.not_after - now

    if remaining <= timedelta(0):
        return [make_finding("SEC_TLS_CERT_EXPIRED", evidence)]

    if remaining <= timedelta(days=TLS_EXPIRY_HIGH_DAYS):
        return [make_finding("SEC_TLS_CERT_EXPIRES_SOON_14", evidence)]

    if remaining <= timedelta(days=TLS_EXPIRY_MEDIUM_DAYS):
        return [make_finding("SEC_TLS_CERT_EXPIRES_SOON_30", evidence)]

    return []


def _verification_failure(observation: TlsObservation) -> ScanFinding:
    evidence: dict[str, object] = {
        "verifyCode": observation.verify_code,
        "verifyMessage": (observation.verify_message or "")[:MAX_VERIFY_MESSAGE_CHARS],
    }

    if observation.verify_code == VERIFY_CODE_CERT_HAS_EXPIRED:
        return make_finding("SEC_TLS_CERT_EXPIRED", evidence)

    if observation.verify_code == VERIFY_CODE_CERT_NOT_YET_VALID:
        return make_finding("SEC_TLS_CERT_NOT_YET_VALID", evidence)

    if observation.verify_code == VERIFY_CODE_HOSTNAME_MISMATCH:
        return make_finding("SEC_TLS_HOSTNAME_MISMATCH", evidence)

    return make_finding("SEC_TLS_CHAIN_INVALID", evidence, FindingConfidence.MEDIUM)

from datetime import UTC, datetime, timedelta

import pytest

from ontapulse_worker.modules.scans.domain.models import FindingConfidence
from ontapulse_worker.modules.security_posture.domain.models import TlsObservation, TlsOutcome
from ontapulse_worker.modules.security_posture.domain.tls_rules import evaluate_tls

NOW = datetime(2026, 10, 19, 12, 0, tzinfo=UTC)


def ok(
    *,
    not_after: timedelta | None = timedelta(days=200),
    not_before: timedelta | None = timedelta(days=-30),
    protocol: str = "TLSv1.3",
) -> TlsObservation:
    return TlsObservation(
        outcome=TlsOutcome.HANDSHAKE_OK,
        protocol=protocol,
        subject_cn="example.com",
        issuer="Test CA",
        not_before=None if not_before is None else NOW + not_before,
        not_after=None if not_after is None else NOW + not_after,
    )


def ids(observation: TlsObservation) -> list[str]:
    return sorted(finding.check_id for finding in evaluate_tls(observation, NOW))


@pytest.mark.parametrize(
    ("remaining", "expected"),
    [
        (timedelta(days=365), []),
        (timedelta(days=31), []),
        (timedelta(days=30, seconds=1), []),
        (timedelta(days=30), ["SEC_TLS_CERT_EXPIRES_SOON_30"]),
        (timedelta(days=15), ["SEC_TLS_CERT_EXPIRES_SOON_30"]),
        (timedelta(days=14, seconds=1), ["SEC_TLS_CERT_EXPIRES_SOON_30"]),
        (timedelta(days=14), ["SEC_TLS_CERT_EXPIRES_SOON_14"]),
        (timedelta(days=1), ["SEC_TLS_CERT_EXPIRES_SOON_14"]),
        (timedelta(seconds=1), ["SEC_TLS_CERT_EXPIRES_SOON_14"]),
        (timedelta(0), ["SEC_TLS_CERT_EXPIRED"]),
        (timedelta(days=-1), ["SEC_TLS_CERT_EXPIRED"]),
    ],
)
def test_expiry_bands_use_the_injected_clock(remaining: timedelta, expected: list[str]) -> None:
    assert ids(ok(not_after=remaining)) == expected


def test_a_certificate_that_is_not_yet_valid_is_reported_once() -> None:
    assert ids(ok(not_before=timedelta(days=2))) == ["SEC_TLS_CERT_NOT_YET_VALID"]


@pytest.mark.parametrize(
    ("protocol", "expected"),
    [
        ("TLSv1.3", []),
        ("TLSv1.2", []),
        ("TLSv1.1", ["SEC_TLS_PROTOCOL_DEPRECATED"]),
        ("TLSv1", ["SEC_TLS_PROTOCOL_DEPRECATED"]),
        ("SSLv3", ["SEC_TLS_PROTOCOL_DEPRECATED"]),
    ],
)
def test_protocol_versions(protocol: str, expected: list[str]) -> None:
    assert ids(ok(protocol=protocol)) == expected


def test_an_old_protocol_and_a_near_expiry_are_both_reported() -> None:
    assert ids(ok(protocol="TLSv1.1", not_after=timedelta(days=5))) == [
        "SEC_TLS_CERT_EXPIRES_SOON_14",
        "SEC_TLS_PROTOCOL_DEPRECATED",
    ]


@pytest.mark.parametrize(
    ("code", "expected"),
    [
        (10, "SEC_TLS_CERT_EXPIRED"),
        (9, "SEC_TLS_CERT_NOT_YET_VALID"),
        (62, "SEC_TLS_HOSTNAME_MISMATCH"),
        (18, "SEC_TLS_CHAIN_INVALID"),
        (19, "SEC_TLS_CHAIN_INVALID"),
        (20, "SEC_TLS_CHAIN_INVALID"),
        (21, "SEC_TLS_CHAIN_INVALID"),
        (7, "SEC_TLS_CHAIN_INVALID"),
        (None, "SEC_TLS_CHAIN_INVALID"),
    ],
)
def test_verification_failures_map_by_openssl_code(code: int | None, expected: str) -> None:
    observation = TlsObservation(
        outcome=TlsOutcome.CERT_VERIFICATION_FAILED, verify_code=code, verify_message="msg"
    )

    assert ids(observation) == [expected]


def test_chain_failures_carry_medium_confidence_and_bounded_evidence() -> None:
    observation = TlsObservation(
        outcome=TlsOutcome.CERT_VERIFICATION_FAILED,
        verify_code=18,
        verify_message="x" * 1_000,
    )

    (finding,) = evaluate_tls(observation, NOW)

    assert finding.confidence is FindingConfidence.MEDIUM
    assert len(finding.evidence["verifyMessage"]) == 200
    assert finding.evidence["verifyCode"] == 18


def test_deterministic_findings_have_no_confidence() -> None:
    expired = TlsObservation(outcome=TlsOutcome.CERT_VERIFICATION_FAILED, verify_code=10)

    (finding,) = evaluate_tls(expired, NOW)

    assert finding.confidence is None
    assert finding.severity.value == "CRITICAL"
    assert finding.category.value == "TLS"


def test_no_tls_is_a_medium_confidence_finding_with_the_reason() -> None:
    observation = TlsObservation(outcome=TlsOutcome.NO_TLS, error_reason="WRONG_VERSION_NUMBER")

    (finding,) = evaluate_tls(observation, NOW)

    assert finding.check_id == "SEC_TLS_NO_HTTPS"
    assert finding.confidence is FindingConfidence.MEDIUM
    assert finding.evidence == {"reason": "WRONG_VERSION_NUMBER"}


def test_evidence_lists_the_certificate_fields_and_days_remaining() -> None:
    (finding,) = evaluate_tls(ok(not_after=timedelta(days=10)), NOW)

    assert finding.evidence == {
        "subjectCn": "example.com",
        "issuer": "Test CA",
        "protocol": "TLSv1.3",
        "notBefore": (NOW - timedelta(days=30)).isoformat(),
        "notAfter": (NOW + timedelta(days=10)).isoformat(),
        "daysRemaining": 10,
    }


def test_a_certificate_without_dates_yields_no_validity_finding() -> None:
    assert ids(ok(not_after=None, not_before=None)) == []

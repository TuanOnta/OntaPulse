"""Tests for HTTP target URL validation."""

from collections.abc import Collection

import pytest

from ontapulse_worker.modules.scans.adapters.outbound.http.url_security import (
    PublicTargetUrlValidator,
)
from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError


def resolver_returning(
    *addresses: str,
):
    def resolve(
        hostname: str,
        port: int,
    ) -> Collection[str]:
        assert hostname
        assert port > 0

        return addresses

    return resolve


def test_accepts_target_resolving_to_public_address() -> None:
    validator = PublicTargetUrlValidator(
        resolver=resolver_returning(
            "93.184.216.34",
        ),
    )

    validator.validate(
        "https://example.com/health",
    )


@pytest.mark.parametrize(
    "address",
    [
        "127.0.0.1",
        "10.0.0.1",
        "172.16.0.1",
        "192.168.1.1",
        "169.254.169.254",
        "0.0.0.0",
        "::1",
        "fc00::1",
        "fe80::1",
    ],
)
def test_rejects_non_public_address(
    address: str,
) -> None:
    validator = PublicTargetUrlValidator(
        resolver=resolver_returning(address),
    )

    with pytest.raises(
        ScanExecutionError,
        match="Scan target is not publicly reachable",
    ):
        validator.validate(
            "https://example.com",
        )


def test_rejects_when_one_dns_result_is_private() -> None:
    validator = PublicTargetUrlValidator(
        resolver=resolver_returning(
            "93.184.216.34",
            "127.0.0.1",
        ),
    )

    with pytest.raises(
        ScanExecutionError,
        match="Scan target is not publicly reachable",
    ):
        validator.validate(
            "https://example.com",
        )


@pytest.mark.parametrize(
    "target_url",
    [
        "",
        "example.com",
        "ftp://example.com",
        "file:///etc/passwd",
        "https:///missing-host",
        "https://user:password@example.com",
        "https://example.com:99999",
    ],
)
def test_rejects_invalid_url(
    target_url: str,
) -> None:
    validator = PublicTargetUrlValidator(
        resolver=resolver_returning(
            "93.184.216.34",
        ),
    )

    with pytest.raises(
        ScanExecutionError,
        match="Scan target URL is invalid",
    ):
        validator.validate(target_url)


def test_converts_dns_failure_to_safe_error() -> None:
    def failing_resolver(
        hostname: str,
        port: int,
    ) -> Collection[str]:
        raise OSError("DNS server unavailable")

    validator = PublicTargetUrlValidator(
        resolver=failing_resolver,
    )

    with pytest.raises(
        ScanExecutionError,
        match="Scan target hostname could not be resolved",
    ) as captured:
        validator.validate(
            "https://example.com",
        )

    assert isinstance(
        captured.value.__cause__,
        OSError,
    )

import json
from dataclasses import asdict
from pathlib import Path

import pytest

from ontapulse_worker.modules.edge_detection.domain import detector as detector_module
from ontapulse_worker.modules.edge_detection.domain.detector import (
    detect_edge,
    is_confirmed_challenge,
)
from ontapulse_worker.modules.edge_detection.domain.fingerprints import (
    CHALLENGE_COOKIE_NAMES,
    CHALLENGE_MARKER_HEADERS,
    MAX_DETECTIONS,
    MAX_SIGNALS_PER_DETECTION,
    RULES,
    NameMatch,
)
from ontapulse_worker.modules.edge_detection.domain.models import EdgeInput, EdgeResponse
from ontapulse_worker.modules.scans.domain.models import (
    EdgeLayer,
    EdgeSignalType,
    FindingConfidence,
)

HIGH = FindingConfidence.HIGH
MEDIUM = FindingConfidence.MEDIUM
LOW = FindingConfidence.LOW
CDN = EdgeLayer.CDN
WAF = EdgeLayer.WAF
ANTI_BOT = EdgeLayer.ANTI_BOT
HEADER = EdgeSignalType.HEADER_NAME
COOKIE = EdgeSignalType.COOKIE_NAME
MARKER = EdgeSignalType.STATUS_MARKER


def reply(
    status: int = 200,
    headers: dict[str, tuple[str, ...]] | None = None,
    cookies: tuple[str, ...] = (),
) -> EdgeResponse:
    return EdgeResponse(status_code=status, headers=headers or {}, cookie_names=cookies)


def summary(profile):
    return [
        (
            item.vendor,
            item.layer,
            item.confidence,
            [(signal.type, signal.name) for signal in item.signals],
        )
        for item in profile.detections
    ]


# Header sets are synthetic: names and value classes follow each vendor's documentation.
CASES = [
    pytest.param(
        [reply(headers={"cf-ray": ("8c1-AMS",)})],
        [("CLOUDFLARE", CDN, MEDIUM, [(HEADER, "cf-ray")])],
        False,
        id="cloudflare-cdn-one-strong-signal",
    ),
    pytest.param(
        [reply(headers={"cf-ray": ("8c1-AMS",), "cf-cache-status": ("HIT",)})],
        [("CLOUDFLARE", CDN, MEDIUM, [(HEADER, "cf-cache-status"), (HEADER, "cf-ray")])],
        False,
        id="cloudflare-two-headers-are-one-signal-type",
    ),
    pytest.param(
        [reply(headers={"cf-cache-status": ("DYNAMIC",)})],
        [("CLOUDFLARE", CDN, LOW, [(HEADER, "cf-cache-status")])],
        False,
        id="cloudflare-weak-only",
    ),
    pytest.param(
        [reply(403, {"cf-ray": ("x",), "cf-mitigated": ("challenge",)})],
        [
            ("CLOUDFLARE", CDN, MEDIUM, [(HEADER, "cf-ray")]),
            ("CLOUDFLARE", WAF, MEDIUM, [(MARKER, "cf-mitigated")]),
        ],
        True,
        id="cloudflare-challenge-is-waf-layer-and-observed",
    ),
    pytest.param(
        [reply(headers={"cf-mitigated": ("other",)})],
        [],
        False,
        id="cloudflare-mitigated-with-another-value-is-ignored",
    ),
    pytest.param(
        [reply(headers={"x-amz-cf-id": ("abc",), "server": ("CloudFront",)})],
        [
            (
                "AWS_CLOUDFRONT",
                CDN,
                MEDIUM,
                [(HEADER, "server"), (HEADER, "x-amz-cf-*")],
            )
        ],
        False,
        id="cloudfront-prefix-and-server",
    ),
    pytest.param(
        [reply(headers={"server": ("CloudFront",)})],
        [("AWS_CLOUDFRONT", CDN, LOW, [(HEADER, "server")])],
        False,
        id="cloudfront-server-only-is-low",
    ),
    pytest.param(
        [reply(202, {"x-amzn-waf-action": ("challenge",)})],
        [("AWS_WAF", WAF, MEDIUM, [(MARKER, "x-amzn-waf-action")])],
        True,
        id="aws-waf-challenge-202",
    ),
    pytest.param(
        [reply(405, {"x-amzn-waf-action": ("CAPTCHA",)})],
        [("AWS_WAF", WAF, MEDIUM, [(MARKER, "x-amzn-waf-action")])],
        True,
        id="aws-waf-captcha-405",
    ),
    pytest.param(
        [reply(headers={"x-vercel-id": ("iad1::abc",), "server": ("Vercel",)})],
        [("VERCEL", CDN, MEDIUM, [(HEADER, "server"), (HEADER, "x-vercel-id")])],
        False,
        id="vercel",
    ),
    pytest.param(
        [reply(headers={"x-served-by": ("cache-ams21034-AMS",)})],
        [("FASTLY", CDN, MEDIUM, [(HEADER, "x-served-by")])],
        False,
        id="fastly-value-prefix",
    ),
    pytest.param(
        [reply(headers={"x-served-by": ("web-01",)})],
        [],
        False,
        id="x-served-by-from-another-proxy-is-ignored",
    ),
    pytest.param(
        [reply(403, cookies=("datadome",))],
        [("DATADOME", ANTI_BOT, MEDIUM, [(COOKIE, "datadome")])],
        True,
        id="datadome-403-cookie-is-a-challenge",
    ),
    pytest.param(
        [reply(200, cookies=("datadome",))],
        [("DATADOME", ANTI_BOT, LOW, [(COOKIE, "datadome")])],
        False,
        id="datadome-2xx-cookie-is-weak-and-not-a-challenge",
    ),
    pytest.param(
        [reply(403, {"x-dd-b": ("1",)}, cookies=("datadome",))],
        [("DATADOME", ANTI_BOT, HIGH, [(COOKIE, "datadome"), (HEADER, "x-dd-b")])],
        True,
        id="datadome-two-signal-types-is-high",
    ),
    pytest.param(
        [reply(200, cookies=("_pxhd",))],
        [("HUMAN_PERIMETERX", ANTI_BOT, MEDIUM, [(COOKIE, "_px*"), (COOKIE, "_pxhd")])],
        False,
        id="human-pxhd-on-2xx-is-not-a-challenge",
    ),
    pytest.param(
        [reply(403, cookies=("_pxhd", "_px3"))],
        [("HUMAN_PERIMETERX", ANTI_BOT, MEDIUM, [(COOKIE, "_px*"), (COOKIE, "_pxhd")])],
        True,
        id="human-pxhd-on-403-is-a-challenge",
    ),
    pytest.param(
        [
            reply(headers={"x-amz-cf-id": ("a",)}),
            reply(403, {"x-amzn-waf-action": ("challenge",)}),
        ],
        [
            ("AWS_CLOUDFRONT", CDN, MEDIUM, [(HEADER, "x-amz-cf-*")]),
            ("AWS_WAF", WAF, MEDIUM, [(MARKER, "x-amzn-waf-action")]),
        ],
        True,
        id="two-layers-cloudfront-with-aws-waf",
    ),
    pytest.param(
        [
            reply(headers={"cf-ray": ("a",)}),
            reply(301, {"cf-ray": ("b",)}),
        ],
        [("CLOUDFLARE", CDN, MEDIUM, [(HEADER, "cf-ray")])],
        False,
        id="same-signal-in-both-responses-counts-once",
    ),
    pytest.param(
        [reply(headers={"server": ("nginx",), "content-type": ("text/html",)})],
        [],
        False,
        id="unknown-site-has-no-detection",
    ),
    pytest.param(
        [reply(403)],
        [],
        False,
        id="a-plain-403-is-not-a-confirmed-challenge",
    ),
    pytest.param(
        [reply(headers={"CF-RAY": ("a",)})],
        [("CLOUDFLARE", CDN, MEDIUM, [(HEADER, "cf-ray")])],
        False,
        id="header-names-are-case-insensitive",
    ),
]


@pytest.mark.parametrize(("responses", "expected", "challenge"), CASES)
def test_detects_vendors_from_collected_signals(responses, expected, challenge) -> None:
    profile = detect_edge(EdgeInput(responses=tuple(responses)))

    assert summary(profile) == expected
    assert profile.challenge_observed is challenge


def test_no_responses_means_no_detection() -> None:
    profile = detect_edge(EdgeInput(responses=()))

    assert profile.detections == ()
    assert profile.challenge_observed is False


def test_output_never_contains_a_header_or_cookie_value() -> None:
    secret = "super-secret-value-123"
    profile = detect_edge(
        EdgeInput(
            responses=(
                reply(
                    403,
                    {
                        "cf-ray": (secret,),
                        "x-served-by": (f"cache-{secret}",),
                        "server": (secret,),
                        "x-amz-cf-id": (secret,),
                    },
                    cookies=("datadome",),
                ),
            ),
            tls_issuer=secret,
        )
    )

    assert secret not in json.dumps(asdict(profile), default=str)


def test_confidence_levels_follow_the_signal_strength_and_types() -> None:
    levels = {
        (item.vendor, item.layer): item.confidence
        for item in detect_edge(
            EdgeInput(
                responses=(
                    reply(
                        403,
                        {"x-dd-b": ("1",), "cf-cache-status": ("MISS",), "x-vercel-id": ("a",)},
                        cookies=("datadome",),
                    ),
                )
            )
        ).detections
    }

    assert levels == {
        ("CLOUDFLARE", CDN): LOW,
        ("DATADOME", ANTI_BOT): HIGH,
        ("VERCEL", CDN): MEDIUM,
    }


def test_the_input_accepts_dns_and_issuer_signals_without_a_rule_for_them() -> None:
    profile = detect_edge(
        EdgeInput(
            responses=(reply(),),
            tls_issuer="Example CA",
            cname_targets=("example.cloudfront.net",),
            ns_targets=("ns.example.net",),
        )
    )

    assert profile.detections == ()


def test_detections_and_signals_are_bounded(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(detector_module, "MAX_DETECTIONS", 2)
    monkeypatch.setattr(detector_module, "MAX_SIGNALS_PER_DETECTION", 1)

    profile = detect_edge(
        EdgeInput(
            responses=(
                reply(
                    headers={
                        "cf-ray": ("a",),
                        "cf-cache-status": ("HIT",),
                        "x-vercel-id": ("a",),
                        "x-served-by": ("cache-a",),
                    }
                ),
            )
        )
    )

    assert len(profile.detections) == 2
    assert all(len(item.signals) == 1 for item in profile.detections)
    assert MAX_DETECTIONS >= 7
    assert MAX_SIGNALS_PER_DETECTION >= 2


def test_output_is_sorted_so_repeated_scans_compare_equal() -> None:
    first = detect_edge(
        EdgeInput(responses=(reply(headers={"x-vercel-id": ("a",), "cf-ray": ("b",)}),))
    )
    second = detect_edge(
        EdgeInput(responses=(reply(headers={"cf-ray": ("b",), "x-vercel-id": ("a",)}),))
    )

    assert first == second


@pytest.mark.parametrize(
    ("status", "headers", "cookies", "expected"),
    [
        (200, {"cf-mitigated": ("challenge",)}, (), True),
        (200, {"cf-mitigated": (" Challenge ",)}, (), True),
        (200, {"x-amzn-waf-action": ("captcha",)}, (), True),
        (200, {"x-amzn-waf-action": ("block",)}, (), False),
        (403, {}, (), False),
        (429, {}, (), False),
        (403, {}, ("datadome",), True),
        (403, {}, ("DataDome",), True),
        (200, {}, ("datadome",), False),
        (503, {}, ("_pxhd",), True),
        (200, {}, ("_pxhd",), False),
        (403, {}, ("session",), False),
    ],
)
def test_confirmed_challenge_rules(status, headers, cookies, expected) -> None:
    assert is_confirmed_challenge(status, headers, cookies) is expected


def test_the_rule_table_matches_the_catalog_invariants() -> None:
    vendors = {rule.vendor for rule in RULES}

    assert vendors == {
        "CLOUDFLARE",
        "AWS_CLOUDFRONT",
        "AWS_WAF",
        "VERCEL",
        "FASTLY",
        "DATADOME",
        "HUMAN_PERIMETERX",
    }
    # Akamai and Imperva have no primary source yet, so they must not be guessed.
    assert not vendors & {"AKAMAI", "IMPERVA"}
    # No rule may use a signal type the catalog says has no verified pattern yet.
    assert {rule.signal_type for rule in RULES} <= {HEADER, COOKIE, MARKER}
    for rule in RULES:
        assert rule.name == rule.name.lower()
        assert rule.values is None or all(value == value.lower() for value in rule.values)
        if rule.name_match is NameMatch.PREFIX:
            assert rule.signal_name.endswith("*")
    for header, values in CHALLENGE_MARKER_HEADERS.items():
        assert header == header.lower()
        assert all(value == value.lower() for value in values)
    assert all(name == name.lower() for name in CHALLENGE_COOKIE_NAMES)


def test_the_detector_modules_import_no_network_or_clock_code() -> None:
    forbidden = ("httpx", "socket", "ssl", "pika", "sqlalchemy", "datetime", "time", "requests")
    root = Path(detector_module.__file__).parent

    for path in root.glob("*.py"):
        imported = {
            line.split()[1].split(".")[0]
            for line in path.read_text(encoding="utf-8").splitlines()
            if line.startswith(("import ", "from "))
        }
        assert not imported & set(forbidden), path.name

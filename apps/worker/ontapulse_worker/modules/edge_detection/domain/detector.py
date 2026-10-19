"""Pure edge detector: plain data in, an observation out. No network, no clock, no I/O.

Detection only. A vendor header proves the vendor's edge was in the path, not that a rule set is
enabled, so the output is informational and worded "observed". Header and cookie values are matched
in memory and never copied into the result.
"""

from collections.abc import Mapping

from ontapulse_worker.modules.edge_detection.domain.fingerprints import (
    CHALLENGE_COOKIE_NAMES,
    CHALLENGE_MARKER_HEADERS,
    MAX_DETECTIONS,
    MAX_SIGNALS_PER_DETECTION,
    RULES,
    NameMatch,
    Rule,
    StatusClass,
    Strength,
)
from ontapulse_worker.modules.edge_detection.domain.models import EdgeInput, EdgeResponse
from ontapulse_worker.modules.scans.domain.models import (
    EdgeDetection,
    EdgeLayer,
    EdgeProfile,
    EdgeSignal,
    EdgeSignalType,
    FindingConfidence,
)

MIN_INDEPENDENT_SIGNAL_TYPES_FOR_HIGH = 2


def is_success(status_code: int) -> bool:
    return 200 <= status_code < 300


def is_confirmed_challenge(
    status_code: int,
    headers: Mapping[str, tuple[str, ...]],
    cookie_names: tuple[str, ...],
) -> bool:
    """A verified marker header, or an anti-bot challenge cookie on a non-2xx response."""
    for name, markers in CHALLENGE_MARKER_HEADERS.items():
        if any(_normalize(value) in markers for value in headers.get(name, ())):
            return True

    if is_success(status_code):
        return False

    return any(name.lower() in CHALLENGE_COOKIE_NAMES for name in cookie_names)


def detect_edge(data: EdgeInput) -> EdgeProfile:
    # (vendor, layer) -> {(type, name): strength}; a signal seen twice counts once.
    found: dict[tuple[str, EdgeLayer], dict[tuple[str, str], Rule]] = {}

    for response in data.responses:
        for rule in RULES:
            if _matches(rule, response):
                signals = found.setdefault((rule.vendor, rule.layer), {})
                key = (rule.signal_type.value, rule.signal_name)
                known = signals.get(key)

                if known is None or (
                    known.strength is Strength.WEAK and rule.strength is Strength.STRONG
                ):
                    signals[key] = rule

    detections = [
        _detection(vendor, layer, signals) for (vendor, layer), signals in sorted(found.items())
    ]

    return EdgeProfile(
        detections=tuple(detections[:MAX_DETECTIONS]),
        challenge_observed=any(
            is_confirmed_challenge(item.status_code, item.headers, item.cookie_names)
            for item in data.responses
        ),
    )


def _detection(
    vendor: str, layer: EdgeLayer, signals: dict[tuple[str, str], Rule]
) -> EdgeDetection:
    rules = sorted(signals.values(), key=lambda rule: (rule.signal_type.value, rule.signal_name))
    types = {rule.signal_type for rule in rules}

    if len(types) >= MIN_INDEPENDENT_SIGNAL_TYPES_FOR_HIGH:
        confidence = FindingConfidence.HIGH
    elif any(rule.strength is Strength.STRONG for rule in rules):
        confidence = FindingConfidence.MEDIUM
    else:
        confidence = FindingConfidence.LOW

    return EdgeDetection(
        vendor=vendor,
        layer=layer,
        confidence=confidence,
        signals=tuple(
            EdgeSignal(type=rule.signal_type, name=rule.signal_name)
            for rule in rules[:MAX_SIGNALS_PER_DETECTION]
        ),
    )


def _matches(rule: Rule, response: EdgeResponse) -> bool:
    if rule.status is StatusClass.SUCCESS and not is_success(response.status_code):
        return False

    if rule.status is StatusClass.NON_SUCCESS and is_success(response.status_code):
        return False

    if rule.signal_type is EdgeSignalType.COOKIE_NAME:
        return any(_name_matches(rule, name) for name in response.cookie_names)

    for header, values in response.headers.items():
        if _name_matches(rule, header) and _value_matches(rule, values):
            return True

    return False


def _name_matches(rule: Rule, name: str) -> bool:
    lowered = name.lower()

    if rule.name_match is NameMatch.PREFIX:
        return lowered.startswith(rule.name)

    return lowered == rule.name


def _value_matches(rule: Rule, values: tuple[str, ...]) -> bool:
    if rule.values is None and rule.value_prefix is None:
        return True

    for value in values:
        normalized = _normalize(value)

        if rule.values is not None and normalized in rule.values:
            return True

        if rule.value_prefix is not None and normalized.startswith(rule.value_prefix):
            return True

    return False


def _normalize(value: str) -> str:
    return value.strip().lower()

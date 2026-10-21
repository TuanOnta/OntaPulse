"""Normalization of DNS records before storing and diffing.

Lowercase names, strip the trailing dot, ignore the TTL, sort and deduplicate the values of a type
(docs/security-checks.md section 11.1). TXT content is case sensitive and is kept as it is.
"""

import ipaddress

from ontapulse_worker.modules.dns_watch.domain.models import RecordType

ROOT_LABEL = "."


def normalize_name(value: str) -> str:
    return value.strip().lower().rstrip(".")


def _normalize_address(value: str) -> str:
    text = value.strip()

    try:
        return str(ipaddress.ip_address(text))
    except ValueError:
        return text.lower()


def _normalize_mx(value: str) -> str:
    parts = value.strip().split(None, 1)

    if len(parts) != 2:
        return value.strip().lower()

    preference, host = parts
    exchange = ROOT_LABEL if host.strip() == ROOT_LABEL else normalize_name(host)

    try:
        return f"{int(preference)} {exchange}"
    except ValueError:
        return f"{preference} {exchange}"


def normalize_value(record_type: RecordType, value: str) -> str:
    if record_type in (RecordType.A, RecordType.AAAA):
        return _normalize_address(value)

    if record_type in (RecordType.CNAME, RecordType.NS):
        return normalize_name(value)

    if record_type is RecordType.MX:
        return _normalize_mx(value)

    return value


def normalize_values(record_type: RecordType, values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(sorted({normalize_value(record_type, value) for value in values}))

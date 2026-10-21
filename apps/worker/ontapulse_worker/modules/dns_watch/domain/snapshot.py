"""Stored snapshot document, its bounds, and the diff against the baseline.

The document is `{ "host": { "name", A, AAAA, CNAME, NS, MX, TXT }, "organization": { "name",
NS, MX } }`.
A record type whose query failed is unknown and is never diffed: the previous value is kept, so
a failed
query can neither produce a change finding nor erase the baseline.
"""

import json
from collections.abc import Mapping
from typing import Any

from ontapulse_worker.modules.dns_watch.domain.models import (
    HOST_RECORD_TYPES,
    ORGANIZATION_RECORD_TYPES,
    SCOPE_HOST,
    SCOPE_ORGANIZATION,
    Snapshot,
)
from ontapulse_worker.modules.scans.domain.models import RecordChange

MAX_SNAPSHOT_BYTES = 16_384
MAX_VALUES_PER_TYPE = 100
MAX_VALUE_CHARS = 512
MAX_NAME_CHARS = 255


def _previous_values(previous: Mapping[str, Any] | None, scope: str, record_type: str) -> list[str]:
    if not previous:
        return []

    section = previous.get(scope)

    if not isinstance(section, Mapping):
        return []

    values = section.get(record_type)

    return [item for item in values if isinstance(item, str)] if isinstance(values, list) else []


def _previous_name(previous: Mapping[str, Any] | None, scope: str) -> str | None:
    section = previous.get(scope) if previous else None
    name = section.get("name") if isinstance(section, Mapping) else None

    return name if isinstance(name, str) else None


def _size(document: Mapping[str, Any]) -> int:
    return len(json.dumps(document).encode())


def bound_document(document: dict[str, Any]) -> dict[str, Any]:
    """Cap the value count and length, then shrink the longest list until the JSON fits."""
    for scope in (SCOPE_HOST, SCOPE_ORGANIZATION):
        section = document[scope]
        section["name"] = section["name"][:MAX_NAME_CHARS]

        for key, value in list(section.items()):
            if isinstance(value, list):
                section[key] = [item[:MAX_VALUE_CHARS] for item in value[:MAX_VALUES_PER_TYPE]]

    while _size(document) > MAX_SNAPSHOT_BYTES:
        lists = [
            value
            for scope in (SCOPE_HOST, SCOPE_ORGANIZATION)
            for value in document[scope].values()
            if isinstance(value, list) and value
        ]

        if not lists:
            break

        max(lists, key=len).pop()

    return document


def to_document(snapshot: Snapshot, previous: Mapping[str, Any] | None) -> dict[str, Any]:
    """The document to store: unknown types keep their previous values (or stay empty)."""
    host: dict[str, Any] = {"name": snapshot.host_name}

    for record_type in HOST_RECORD_TYPES:
        current = snapshot.host.get(record_type.value)
        host[record_type.value] = (
            list(current)
            if current is not None
            else _previous_values(previous, SCOPE_HOST, record_type.value)
        )

    organization: dict[str, Any] = {"name": snapshot.organization_name}
    same_organization = _previous_name(previous, SCOPE_ORGANIZATION) == snapshot.organization_name

    for record_type in ORGANIZATION_RECORD_TYPES:
        current = snapshot.organization.get(record_type.value)
        organization[record_type.value] = (
            list(current)
            if current is not None
            else (
                _previous_values(previous, SCOPE_ORGANIZATION, record_type.value)
                if same_organization
                else []
            )
        )

    return bound_document({SCOPE_HOST: host, SCOPE_ORGANIZATION: organization})


def _diff_type(
    scope: str,
    record_type: str,
    old: list[str],
    new: tuple[str, ...],
) -> RecordChange | None:
    added = tuple(sorted(set(new) - set(old)))
    removed = tuple(sorted(set(old) - set(new)))

    if not added and not removed:
        return None

    return RecordChange(scope, record_type, added, removed)


def diff_snapshot(previous: Mapping[str, Any] | None, snapshot: Snapshot) -> list[RecordChange]:
    """Changes of every known (queried) type against the baseline. Unknown types are skipped."""
    if not previous:
        return []

    changes: list[RecordChange] = []

    for record_type in HOST_RECORD_TYPES:
        current = snapshot.host.get(record_type.value)

        if current is None:
            continue

        change = _diff_type(
            SCOPE_HOST,
            record_type.value,
            _previous_values(previous, SCOPE_HOST, record_type.value),
            current,
        )

        if change:
            changes.append(change)

    # A different organizational domain (for example a DMARC record appeared higher up) is a new
    # frame of reference, not a change of its records.
    if _previous_name(previous, SCOPE_ORGANIZATION) != snapshot.organization_name:
        return changes

    for record_type in ORGANIZATION_RECORD_TYPES:
        current = snapshot.organization.get(record_type.value)

        if current is None:
            continue

        change = _diff_type(
            SCOPE_ORGANIZATION,
            record_type.value,
            _previous_values(previous, SCOPE_ORGANIZATION, record_type.value),
            current,
        )

        if change:
            changes.append(change)

    return changes

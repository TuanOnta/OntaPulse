"""Pure builders of DNS_WATCH findings from already collected data. No I/O, no clock."""

import json
from dataclasses import dataclass

from ontapulse_worker.modules.dns_watch.domain.catalog import (
    MAX_EVIDENCE_BYTES,
    MAX_EVIDENCE_CHANGES,
    MAX_EVIDENCE_VALUE_CHARS,
    MAX_EVIDENCE_VALUES,
    make_finding,
)
from ontapulse_worker.modules.dns_watch.domain.dkim import DkimKey
from ontapulse_worker.modules.dns_watch.domain.dmarc import DmarcSelection
from ontapulse_worker.modules.dns_watch.domain.models import SCOPE_HOST, SCOPE_ORGANIZATION
from ontapulse_worker.modules.dns_watch.domain.spf import MAX_SPF_LOOKUPS
from ontapulse_worker.modules.scans.domain.models import (
    FindingConfidence,
    RecordChange,
    ScanFinding,
)

NULL_MX = "0 ."
ADDRESS_TYPES = ("A", "AAAA")

_CHANGE_CHECK_IDS = {
    ("NS", SCOPE_HOST): "DNS_NS_CHANGED",
    ("NS", SCOPE_ORGANIZATION): "DNS_NS_CHANGED",
    ("CNAME", SCOPE_HOST): "DNS_CNAME_CHANGED",
    ("MX", SCOPE_HOST): "DNS_MX_CHANGED",
    ("MX", SCOPE_ORGANIZATION): "DNS_MX_CHANGED",
    ("TXT", SCOPE_HOST): "DNS_TXT_CHANGED",
}


def _bounded(values: tuple[str, ...], limit: int) -> list[str]:
    return [value[:MAX_EVIDENCE_VALUE_CHARS] for value in values[:limit]]


def _items(changes: list[RecordChange], limit: int) -> list[dict[str, object]]:
    return [
        {
            "scope": change.scope,
            "type": change.record_type,
            "added": _bounded(change.added, limit),
            "removed": _bounded(change.removed, limit),
        }
        for change in changes[:MAX_EVIDENCE_CHANGES]
    ]


def _fits(items: list[dict[str, object]]) -> bool:
    return len(json.dumps({"changes": items}).encode()) <= MAX_EVIDENCE_BYTES


def _change_evidence(changes: list[RecordChange]) -> dict[str, object]:
    """Bounded evidence: fewer values per list first, then fewer entries, never an empty result."""
    limit = MAX_EVIDENCE_VALUES
    items = _items(changes, limit)

    while not _fits(items) and limit > 1:
        limit = max(1, limit // 2)
        items = _items(changes, limit)

    while len(items) > 1 and not _fits(items):
        items.pop()

    return {"changes": items}


def change_findings(changes: list[RecordChange], cdn_fronted: bool) -> list[ScanFinding]:
    """One finding per check ID. Address churn is `LOW` and informational behind a CDN."""
    grouped: dict[str, list[RecordChange]] = {}

    for change in changes:
        if change.scope == SCOPE_HOST and change.record_type in ADDRESS_TYPES:
            check_id = "DNS_ADDRESS_CHANGED_EDGE" if cdn_fronted else "DNS_ADDRESS_CHANGED"
        else:
            check_id = _CHANGE_CHECK_IDS.get((change.record_type, change.scope), "")

        if check_id:
            grouped.setdefault(check_id, []).append(change)

    confidences = {
        "DNS_ADDRESS_CHANGED": FindingConfidence.MEDIUM,
        "DNS_ADDRESS_CHANGED_EDGE": FindingConfidence.LOW,
    }

    return [
        make_finding(check_id, _change_evidence(items), confidences.get(check_id))
        for check_id, items in grouped.items()
    ]


def dangling_finding(chain: list[str], hop: str, reason: str) -> ScanFinding:
    return make_finding(
        "DNS_DANGLING_CNAME",
        {"chain": chain[:MAX_EVIDENCE_VALUES], "name": hop, "reason": reason},
        FindingConfidence.MEDIUM,
    )


@dataclass(frozen=True)
class SpfSummary:
    """What the SPF records of the organizational domain showed, after following
    include/redirect."""

    record_count: int
    all_qualifier: str | None
    has_ptr: bool
    lookups: int


def accepts_mail(mx_values: tuple[str, ...] | None) -> bool:
    """True when the domain publishes an MX other than the null MX (RFC 7505: `0 .`)."""
    return bool(mx_values) and tuple(mx_values) != (NULL_MX,)


def spf_findings(organization: str, spf: SpfSummary, mail: bool) -> list[ScanFinding]:
    if spf.record_count == 0:
        return [make_finding("EMAIL_SPF_MISSING", {"domain": organization})] if mail else []

    if spf.record_count > 1:
        return [make_finding("EMAIL_SPF_MULTIPLE", {"domain": organization})]

    findings: list[ScanFinding] = []

    if spf.all_qualifier == "+":
        findings.append(make_finding("EMAIL_SPF_PERMISSIVE", {"domain": organization}))
    elif spf.all_qualifier == "~":
        findings.append(
            make_finding("EMAIL_SPF_SOFTFAIL", {"domain": organization}, FindingConfidence.LOW)
        )

    if spf.has_ptr:
        findings.append(make_finding("EMAIL_SPF_PTR", {"domain": organization}))

    if spf.lookups > MAX_SPF_LOOKUPS:
        findings.append(
            make_finding(
                "EMAIL_SPF_TOO_MANY_LOOKUPS",
                {"domain": organization, "lookups": spf.lookups, "limit": MAX_SPF_LOOKUPS},
                FindingConfidence.MEDIUM,
            )
        )

    return findings


def dmarc_findings(selection: DmarcSelection, mail: bool) -> list[ScanFinding]:
    findings: list[ScanFinding] = []

    if selection.multiple_names:
        findings.append(
            make_finding(
                "EMAIL_DMARC_MULTIPLE",
                {"names": list(selection.multiple_names)[:MAX_EVIDENCE_VALUES]},
            )
        )

    record = selection.policy

    if record is None:
        if mail and not selection.multiple_names:
            findings.append(
                make_finding("EMAIL_DMARC_MISSING", {"domain": selection.organization_domain})
            )

        return findings

    evidence = {"domain": selection.policy_name, "policy": record.policy}

    if record.policy == "none":
        findings.append(make_finding("EMAIL_DMARC_POLICY_NONE", evidence))

    if not record.has_reporting:
        findings.append(make_finding("EMAIL_DMARC_NO_REPORTING", {"domain": selection.policy_name}))

    return findings


def dkim_findings(keys: list[tuple[str, DkimKey]], mail: bool) -> list[ScanFinding]:
    """A domain that sends no mail legitimately publishes revoked keys (often as a wildcard)."""
    findings: list[ScanFinding] = []

    for selector, key in keys:
        if key.testing:
            findings.append(
                make_finding("EMAIL_DKIM_TESTING", {"selector": selector}, FindingConfidence.LOW)
            )

        if key.revoked and mail:
            findings.append(
                make_finding("EMAIL_DKIM_REVOKED", {"selector": selector}, FindingConfidence.LOW)
            )

    return findings

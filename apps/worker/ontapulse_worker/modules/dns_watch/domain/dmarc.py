"""DMARC record parsing, the DNS tree walk, and organizational domain selection (RFC 9989).

Verified against RFC 9989 section 4.10 (read 2026-10-20): a domain with eight or more labels is cut
from the left until seven remain, so no more than eight queries are made; among the records found
the organizational domain is the name with the fewest labels (a `psd=n` record wins); the policy
record comes from the author domain, then its organizational domain; several records at one name
are all discarded; a record without a usable `p` is treated as `p=none`.

The walk never goes up to a top-level label on its own (names keep at least two labels), and the
fallback when no record exists is the last two labels of the host.
"""

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

DMARC_VERSION = "v=DMARC1"
MAX_TREE_WALK_QUERIES = 8
LABELS_BEFORE_TRUNCATION = 8
LABELS_KEPT_WHEN_TRUNCATED = 7
POLICIES = frozenset({"none", "quarantine", "reject"})


@dataclass(frozen=True)
class DmarcRecord:
    tags: Mapping[str, str]
    policy: str
    has_reporting: bool
    psd: str | None


@dataclass(frozen=True)
class DmarcSelection:
    organization_domain: str
    policy_name: str | None
    policy: DmarcRecord | None
    # Names that held several records; receivers discard all of them.
    multiple_names: tuple[str, ...]


def parse_dmarc(text: str) -> DmarcRecord | None:
    """The record, or None when it is not a DMARC record (`v=DMARC1` must be the first tag)."""
    parts = [part.strip() for part in text.strip().split(";")]
    tags: dict[str, str] = {}
    first = True

    for part in parts:
        if not part:
            continue

        name, separator, value = part.partition("=")
        name = name.strip()

        if first:
            if not separator or name != "v" or value.strip() != "DMARC1":
                return None

            first = False

        if name.lower() not in tags:
            tags[name.lower()] = value.strip()

    if first:
        return None

    policy = tags.get("p", "").lower()

    return DmarcRecord(
        tags=tags,
        policy=policy if policy in POLICIES else "none",
        has_reporting=bool(tags.get("rua")),
        psd=tags.get("psd", "").lower() or None,
    )


def tree_walk_names(host: str) -> list[str]:
    """Names to query as `_dmarc.<name>`: the host, then its parents (at least two labels each)."""
    labels = host.lower().rstrip(".").split(".")
    names = [".".join(labels)]

    if len(labels) >= LABELS_BEFORE_TRUNCATION:
        labels = labels[-LABELS_KEPT_WHEN_TRUNCATED:]
        start = 0
    else:
        start = 1

    names.extend(".".join(labels[index:]) for index in range(start, len(labels) - 1))

    return names[:MAX_TREE_WALK_QUERIES]


def fallback_organization_domain(host: str) -> str:
    labels = host.lower().rstrip(".").split(".")

    return ".".join(labels[-2:])


def select_dmarc(
    host: str,
    records_by_name: Sequence[tuple[str, Sequence[DmarcRecord]]],
) -> DmarcSelection:
    """Apply RFC 9989 to the records found, ordered from the host upward."""
    single: list[tuple[str, DmarcRecord]] = []
    multiple: list[str] = []

    for name, records in records_by_name:
        if len(records) == 1:
            single.append((name, records[0]))
        elif len(records) > 1:
            multiple.append(name)

    candidates = [(name, record) for name, record in single if record.psd != "y"]
    organization: str | None = None

    for name, record in candidates:
        if record.psd == "n":
            organization = name
            break

    if organization is None and candidates:
        organization = min(candidates, key=lambda item: item[0].count("."))[0]

    policy_name: str | None = None
    policy: DmarcRecord | None = None
    by_name = dict(single)
    author = host.lower().rstrip(".")

    for name in (author, organization):
        if name is not None and name in by_name:
            policy_name, policy = name, by_name[name]
            break

    return DmarcSelection(
        organization_domain=organization or fallback_organization_domain(host),
        policy_name=policy_name,
        policy=policy,
        multiple_names=tuple(multiple),
    )

"""SPF record parsing and lookup counting (RFC 7208). Records are never evaluated against a sender.

Verified against RFC 7208 (read 2026-10-20): the version section is exactly `v=spf1` and ends at a
space or the end of the record (ABNF literals are case-insensitive); the terms `include`, `a`, `mx`,
`ptr`, `exists` and the `redirect` modifier cost a DNS lookup and may not exceed 10 in total; the
qualifier defaults to `+`, so a bare `all` is `+all`; a `redirect` modifier is ignored when an `all`
mechanism is present anywhere in the record.
"""

from dataclasses import dataclass

SPF_VERSION = "v=spf1"
MAX_SPF_LOOKUPS = 10
QUALIFIERS = "+-~?"
LOOKUP_MECHANISMS = frozenset({"include", "a", "mx", "ptr", "exists"})


@dataclass(frozen=True)
class SpfRecord:
    """The parts of one SPF record that matter for the findings."""

    all_qualifier: str | None
    includes: tuple[str, ...]
    redirect: str | None
    has_ptr: bool
    lookup_terms: int


def is_spf_record(text: str) -> bool:
    stripped = text.strip()

    if stripped[: len(SPF_VERSION)].lower() != SPF_VERSION:
        return False

    return len(stripped) == len(SPF_VERSION) or stripped[len(SPF_VERSION)] == " "


def parse_spf(text: str) -> SpfRecord:
    all_qualifier: str | None = None
    includes: list[str] = []
    redirect: str | None = None
    has_ptr = False
    lookups = 0

    for term in text.strip().split()[1:]:
        qualifier = term[0] if term[0] in QUALIFIERS else None
        body = term[1:] if qualifier else term
        lowered = body.lower()

        if "=" in lowered.split(":", maxsplit=1)[0]:
            name, _, value = body.partition("=")

            if name.lower() == "redirect" and value:
                redirect = value.lower().rstrip(".")

            continue

        mechanism = lowered.split(":", maxsplit=1)[0].split("/", maxsplit=1)[0]

        if mechanism == "all":
            all_qualifier = qualifier or "+"
        elif mechanism in LOOKUP_MECHANISMS:
            lookups += 1

            if mechanism == "include" and ":" in body:
                includes.append(body.split(":", maxsplit=1)[1].lower().rstrip("."))
            elif mechanism == "ptr":
                has_ptr = True

    # A redirect modifier is ignored when an `all` mechanism is present (RFC 7208 section 6.1).
    effective_redirect = None if all_qualifier is not None else redirect

    return SpfRecord(
        all_qualifier=all_qualifier,
        includes=tuple(includes),
        redirect=effective_redirect,
        has_ptr=has_ptr,
        lookup_terms=lookups + (1 if effective_redirect else 0),
    )

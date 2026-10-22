"""DKIM key record parsing (RFC 6376) and the fixed selector list.

Selectors cannot be enumerated through DNS, so discovery tests this short list and is best effort: a
missing selector is never a finding. Each entry comes from the provider's own documentation (read
2026-10-20): `google` (Google Workspace default prefix selector), `selector1` and `selector2`
(Microsoft 365, published as CNAME records that resolve to the key), `s1` and `s2` (Twilio SendGrid
domain authentication, also CNAME records). Mailchimp was left out: no primary source was found.
"""

from dataclasses import dataclass

DKIM_SELECTORS = ("google", "selector1", "selector2", "s1", "s2")
DKIM_VERSION = "DKIM1"


@dataclass(frozen=True)
class DkimKey:
    testing: bool
    revoked: bool


def parse_dkim(text: str) -> DkimKey | None:
    """The key record, or None when it is not a valid DKIM key record.

    `v`, when present, must be `DKIM1` and the first tag; `p` is required and an empty `p` means
    the key
    was revoked; `t=y` marks testing mode.
    """
    tags: dict[str, str] = {}
    order: list[str] = []

    for part in text.split(";"):
        name, separator, value = part.strip().partition("=")

        if not separator:
            continue

        name = name.strip()

        if name not in tags:
            tags[name] = value.strip()
            order.append(name)

    if "v" in tags and (tags["v"] != DKIM_VERSION or order[0] != "v"):
        return None

    if "p" not in tags:
        return None

    flags = {flag.strip().lower() for flag in tags.get("t", "").split(":")}

    return DkimKey(testing="y" in flags, revoked=tags["p"] == "")

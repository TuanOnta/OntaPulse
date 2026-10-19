"""Vendor fingerprint table (docs/security-checks.md section 10).

Every row comes from the vendor's own documentation; the source is noted next to it. Signals that
only third-party write-ups mention are not used. Akamai and Imperva have no row: no primary
source was found, so they are not detected. Change this file and the catalog together.
"""

from dataclasses import dataclass
from enum import StrEnum

from ontapulse_worker.modules.scans.domain.models import EdgeLayer, EdgeSignalType

# Bounds applied to every profile (catalog section 10).
MAX_DETECTIONS = 16
MAX_SIGNALS_PER_DETECTION = 8
MAX_EDGE_PROFILE_BYTES = 8_192

CLOUDFLARE = "CLOUDFLARE"
AWS_CLOUDFRONT = "AWS_CLOUDFRONT"
AWS_WAF = "AWS_WAF"
VERCEL = "VERCEL"
FASTLY = "FASTLY"
DATADOME = "DATADOME"
HUMAN_PERIMETERX = "HUMAN_PERIMETERX"


class Strength(StrEnum):
    STRONG = "STRONG"
    WEAK = "WEAK"


class NameMatch(StrEnum):
    EXACT = "EXACT"
    PREFIX = "PREFIX"


class StatusClass(StrEnum):
    ANY = "ANY"
    SUCCESS = "SUCCESS"
    NON_SUCCESS = "NON_SUCCESS"


@dataclass(frozen=True)
class Rule:
    vendor: str
    layer: EdgeLayer
    signal_type: EdgeSignalType
    name: str
    strength: Strength
    name_match: NameMatch = NameMatch.EXACT
    # Lowercased exact header values that match; None means the name alone matches.
    values: frozenset[str] | None = None
    value_prefix: str | None = None
    status: StatusClass = StatusClass.ANY

    @property
    def signal_name(self) -> str:
        """Name stored with the signal: the rule's own name, never text from the target."""
        return f"{self.name}*" if self.name_match is NameMatch.PREFIX else self.name


# Challenge markers: a response carrying one is a confirmed challenge (catalog section 9).
# Cloudflare: `cf-mitigated: challenge`. AWS WAF: `x-amzn-waf-action` is `challenge` (202) or
# `captcha` (405).
CHALLENGE_MARKER_HEADERS: dict[str, frozenset[str]] = {
    "cf-mitigated": frozenset({"challenge"}),
    "x-amzn-waf-action": frozenset({"challenge", "captcha"}),
}
# Anti-bot cookies that mark a challenge when set on a non-2xx response. DataDome also sets
# `datadome` on allowed responses, so a 2xx response with it is not a challenge.
CHALLENGE_COOKIE_NAMES = frozenset({"datadome", "_pxhd"})

CDN = EdgeLayer.CDN
WAF = EdgeLayer.WAF
ANTI_BOT = EdgeLayer.ANTI_BOT
HEADER = EdgeSignalType.HEADER_NAME
COOKIE = EdgeSignalType.COOKIE_NAME
MARKER = EdgeSignalType.STATUS_MARKER
STRONG = Strength.STRONG
WEAK = Strength.WEAK

RULES: tuple[Rule, ...] = (
    # developers.cloudflare.com/fundamentals/reference/http-headers/ (Cf-Ray)
    Rule(CLOUDFLARE, CDN, HEADER, "cf-ray", STRONG),
    # developers.cloudflare.com/cache/concepts/cache-responses/ (Cf-Cache-Status)
    Rule(CLOUDFLARE, CDN, HEADER, "cf-cache-status", WEAK),
    # Cloudflare challenge documentation (verified in Phase 2)
    Rule(
        CLOUDFLARE,
        WAF,
        MARKER,
        "cf-mitigated",
        STRONG,
        values=CHALLENGE_MARKER_HEADERS["cf-mitigated"],
    ),
    # CloudFront "Understand response headers policies": reserved `X-Amz-Cf-.*` headers, and the
    # `Server` value CloudFront adds is `CloudFront` (an origin may send its own, so weak).
    Rule(AWS_CLOUDFRONT, CDN, HEADER, "x-amz-cf-", STRONG, name_match=NameMatch.PREFIX),
    Rule(AWS_CLOUDFRONT, CDN, HEADER, "server", WEAK, values=frozenset({"cloudfront"})),
    # AWS WAF "CAPTCHA and Challenge action behavior"
    Rule(
        AWS_WAF,
        WAF,
        MARKER,
        "x-amzn-waf-action",
        STRONG,
        values=CHALLENGE_MARKER_HEADERS["x-amzn-waf-action"],
    ),
    # vercel.com/docs/headers/response-headers (`server: Vercel` can be overridden by proxies)
    Rule(VERCEL, CDN, HEADER, "x-vercel-id", STRONG),
    Rule(VERCEL, CDN, HEADER, "server", WEAK, values=frozenset({"vercel"})),
    # Fastly X-Served-By: `cache-{datacenter}{nodeid}-{datacenter}`
    Rule(FASTLY, CDN, HEADER, "x-served-by", STRONG, value_prefix="cache-"),
    # docs.datadome.co Protection API: `Set-Cookie: datadome=...` comes with a challenge, and the
    # module also sets it on allowed responses. `X-DD-B` appears in an example response.
    Rule(DATADOME, ANTI_BOT, COOKIE, "datadome", STRONG, status=StatusClass.NON_SUCCESS),
    Rule(DATADOME, ANTI_BOT, COOKIE, "datadome", WEAK, status=StatusClass.SUCCESS),
    Rule(DATADOME, ANTI_BOT, HEADER, "x-dd-b", WEAK),
    # docs.humansecurity.com cookies page: `_pxhd` is an HTTP cookie for server-side detection;
    # the `_px*` family is set by JavaScript, so a Set-Cookie match is unlikely and weak.
    Rule(HUMAN_PERIMETERX, ANTI_BOT, COOKIE, "_pxhd", STRONG),
    Rule(HUMAN_PERIMETERX, ANTI_BOT, COOKIE, "_px", WEAK, name_match=NameMatch.PREFIX),
)

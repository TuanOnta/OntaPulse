"""Finding catalog of the DNS_WATCH scan. Mirrors docs/security-checks.md section 11."""

from ontapulse_worker.modules.scans.domain.models import (
    FindingCategory,
    FindingConfidence,
    FindingSeverity,
    ScanFinding,
)
from ontapulse_worker.modules.security_posture.domain.catalog import CatalogEntry

# Budget (section 4) and timeouts.
MAX_DNS_QUERIES_PER_SCAN = 40
DNS_SERVER_TIMEOUT_SECONDS = 2.0
DNS_QUERY_LIFETIME_SECONDS = 5.0
MAX_CNAME_HOPS = 8
MAX_EVIDENCE_BYTES = 4_096
MAX_EVIDENCE_VALUES = 20
MAX_EVIDENCE_VALUE_CHARS = 255
MAX_EVIDENCE_CHANGES = 12

# Sub-check names and skip reasons.
SUB_CHECK_DNS_RECORDS = "dns_records"
SUB_CHECK_DANGLING_CNAME = "dangling_cname"
SUB_CHECK_EMAIL_AUTH = "email_auth"
REASON_CONNECTION_FAILED = "connection_failed"
REASON_BUDGET_EXHAUSTED = "budget_exhausted"
REASON_NOT_APPLICABLE = "not_applicable"

DNS = FindingCategory.DNS
EMAIL = FindingCategory.EMAIL_AUTH
LOW = FindingSeverity.LOW
MEDIUM = FindingSeverity.MEDIUM
HIGH = FindingSeverity.HIGH

CATALOG: dict[str, CatalogEntry] = {
    "DNS_NS_CHANGED": CatalogEntry(
        DNS,
        HIGH,
        "Name servers changed",
        "The NS records observed now differ from the baseline.",
        "Confirm the change was intended.",
    ),
    "DNS_CNAME_CHANGED": CatalogEntry(
        DNS,
        MEDIUM,
        "CNAME target changed",
        "The CNAME record observed now differs from the baseline.",
        "Confirm the change was intended.",
    ),
    "DNS_MX_CHANGED": CatalogEntry(
        DNS,
        MEDIUM,
        "Mail exchangers changed",
        "The MX records observed now differ from the baseline.",
        "Confirm the change was intended.",
    ),
    "DNS_TXT_CHANGED": CatalogEntry(
        DNS,
        LOW,
        "TXT records changed",
        "The TXT records observed now differ from the baseline.",
        "Confirm the change was intended.",
    ),
    "DNS_ADDRESS_CHANGED": CatalogEntry(
        DNS,
        MEDIUM,
        "Host addresses changed",
        "The A or AAAA records observed now differ from the baseline.",
        "Confirm the new address is yours.",
    ),
    "DNS_ADDRESS_CHANGED_EDGE": CatalogEntry(
        DNS,
        LOW,
        "Host addresses changed behind an edge service",
        "The A or AAAA records changed, and the host appears to be served by a CDN.",
        "This is usually normal rotation of the edge service.",
    ),
    "DNS_DANGLING_CNAME": CatalogEntry(
        DNS,
        HIGH,
        "CNAME target does not resolve",
        "The CNAME chain of the host ends at a name that does not exist or has no address.",
        "Remove the record or restore the target.",
    ),
    "EMAIL_SPF_MISSING": CatalogEntry(
        EMAIL,
        MEDIUM,
        "SPF record not observed",
        "No SPF record was observed at the organizational domain, which receives mail.",
        "Publish an SPF record.",
    ),
    "EMAIL_SPF_MULTIPLE": CatalogEntry(
        EMAIL,
        HIGH,
        "Several SPF records observed",
        "More than one SPF record exists at the same name, which RFC 7208 treats as a permanent "
        "error.",
        "Merge them into one record.",
    ),
    "EMAIL_SPF_PERMISSIVE": CatalogEntry(
        EMAIL,
        HIGH,
        "SPF authorizes any sender",
        "The SPF record ends with +all (or a bare all), which authorizes any sender.",
        "Use -all or ~all.",
    ),
    "EMAIL_SPF_SOFTFAIL": CatalogEntry(
        EMAIL,
        LOW,
        "SPF uses softfail",
        "The SPF record ends with ~all.",
        "Consider -all once the sender list is stable.",
    ),
    "EMAIL_SPF_TOO_MANY_LOOKUPS": CatalogEntry(
        EMAIL,
        MEDIUM,
        "SPF needs too many DNS lookups",
        "Following include and redirect terms exceeds the limit of 10 DNS lookups.",
        "Reduce the includes; flatten carefully.",
    ),
    "EMAIL_SPF_PTR": CatalogEntry(
        EMAIL,
        LOW,
        "SPF uses the ptr mechanism",
        "The SPF record uses ptr, which RFC 7208 discourages.",
        "Remove ptr.",
    ),
    "EMAIL_DMARC_MISSING": CatalogEntry(
        EMAIL,
        MEDIUM,
        "DMARC record not observed",
        "No valid DMARC record was found by the tree walk, and the organizational domain "
        "receives mail.",
        "Publish a DMARC record.",
    ),
    "EMAIL_DMARC_POLICY_NONE": CatalogEntry(
        EMAIL,
        LOW,
        "DMARC policy is none",
        "The effective DMARC policy is none, which only monitors.",
        "Move to quarantine or reject when ready.",
    ),
    "EMAIL_DMARC_NO_REPORTING": CatalogEntry(
        EMAIL,
        LOW,
        "DMARC has no aggregate reporting",
        "The DMARC record has no rua tag.",
        "Add an aggregate report address.",
    ),
    "EMAIL_DMARC_MULTIPLE": CatalogEntry(
        EMAIL,
        MEDIUM,
        "Several DMARC records observed",
        "More than one DMARC record exists at one name; receivers discard all of them.",
        "Keep one record.",
    ),
    "EMAIL_DKIM_TESTING": CatalogEntry(
        EMAIL,
        LOW,
        "A DKIM key is in testing mode",
        "A discovered DKIM selector has t=y.",
        "Remove the testing flag when ready.",
    ),
    "EMAIL_DKIM_REVOKED": CatalogEntry(
        EMAIL,
        LOW,
        "A DKIM key is revoked",
        "A discovered DKIM selector has an empty p value.",
        "Remove the stale record or publish a new key.",
    ),
}


def make_finding(
    check_id: str,
    evidence: dict[str, object] | None = None,
    confidence: FindingConfidence | None = None,
) -> ScanFinding:
    entry = CATALOG[check_id]

    return ScanFinding(
        code=check_id,
        title=entry.title,
        severity=entry.severity,
        description=entry.description,
        recommendation=entry.recommendation,
        evidence=evidence,
        check_id=check_id,
        category=entry.category,
        confidence=confidence,
    )

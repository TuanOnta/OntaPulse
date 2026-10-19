"""Check catalog constants for the SECURITY_POSTURE scan.

Mirrors docs/security-checks.md (sections 4 to 6). Change both in the same commit.
"""

from dataclasses import dataclass

from ontapulse_worker.modules.scans.domain.models import (
    FindingCategory,
    FindingConfidence,
    FindingSeverity,
    ScanFinding,
)

# Budget (docs/security-checks.md section 4).
MAX_REQUESTS_PER_SCAN = 2
MAX_TLS_HANDSHAKES_PER_SCAN = 1
USER_AGENT_PRODUCT = "OntaPulse-SecurityScanner"
USER_AGENT_PROJECT_URL = "https://github.com/TuanOnta/OntaPulse"

# Sub-check names and skip reasons (section 2).
SUB_CHECK_HEADERS = "headers"
SUB_CHECK_COOKIES = "cookies"
SUB_CHECK_CORS = "cors"
SUB_CHECK_REDIRECT = "redirect"
SUB_CHECK_TLS = "tls"
SUB_CHECK_EDGE = "edge"
REASON_CONNECTION_FAILED = "connection_failed"
REASON_CHALLENGE_RESPONSE = "challenge_response"
REASON_PREREQUISITE_FAILED = "prerequisite_failed"

# Thresholds.
HSTS_MIN_MAX_AGE_SECONDS = 15_552_000
MAX_CSP_EVIDENCE_CHARS = 2_048
MAX_LOCATION_EVIDENCE_CHARS = 512
MAX_COOKIES_IN_EVIDENCE = 20
MAX_COOKIE_NAME_CHARS = 100
SESSION_COOKIE_NAME_HINTS = ("session", "sess", "sid", "auth", "token", "jwt")
CHALLENGE_STATUS_CODES = frozenset({403, 429, 503})

# TLS (docs/security-checks.md section 6.5).
TLS_CONNECT_TIMEOUT_SECONDS = 5.0
TLS_HANDSHAKE_TIMEOUT_SECONDS = 10.0
TLS_EXPIRY_HIGH_DAYS = 14
TLS_EXPIRY_MEDIUM_DAYS = 30
MAX_VERIFY_MESSAGE_CHARS = 200
# Protocol names as reported by ssl.SSLSocket.version(); RFC 8996 forbids TLS 1.0 and 1.1.
DEPRECATED_TLS_PROTOCOLS = frozenset({"SSLv3", "TLSv1", "TLSv1.1"})
# OpenSSL X509_V_ERR_* values (include/openssl/x509_vfy.h, OpenSSL 3.0).
VERIFY_CODE_CERT_NOT_YET_VALID = 9
VERIFY_CODE_CERT_HAS_EXPIRED = 10
VERIFY_CODE_HOSTNAME_MISMATCH = 62


@dataclass(frozen=True)
class CatalogEntry:
    category: FindingCategory
    severity: FindingSeverity
    title: str
    description: str
    recommendation: str


HDR = FindingCategory.HEADERS
COOKIE = FindingCategory.COOKIES
CORS = FindingCategory.CORS
REDIRECT = FindingCategory.REDIRECT
TLS = FindingCategory.TLS
LOW = FindingSeverity.LOW
MEDIUM = FindingSeverity.MEDIUM
HIGH = FindingSeverity.HIGH
CRITICAL = FindingSeverity.CRITICAL

CATALOG: dict[str, CatalogEntry] = {
    "SEC_HDR_HSTS_MISSING": CatalogEntry(
        HDR,
        MEDIUM,
        "Strict-Transport-Security not observed",
        "The HTTPS response did not include a Strict-Transport-Security header.",
        "Send Strict-Transport-Security over HTTPS with a long max-age.",
    ),
    "SEC_HDR_HSTS_SHORT_MAX_AGE": CatalogEntry(
        HDR,
        LOW,
        "Strict-Transport-Security max-age is short",
        "The observed max-age is below 180 days.",
        "Raise max-age; 31536000 seconds (one year) is common.",
    ),
    "SEC_HDR_HSTS_DISABLED": CatalogEntry(
        HDR,
        MEDIUM,
        "Strict-Transport-Security is disabled",
        "The observed header sets max-age=0, which removes the policy in browsers.",
        "Remove max-age=0 unless HSTS is being retired on purpose.",
    ),
    "SEC_HDR_HSTS_INVALID": CatalogEntry(
        HDR,
        LOW,
        "Strict-Transport-Security header appears invalid",
        "The observed header does not match RFC 6797, so browsers ignore it.",
        "Fix the header syntax: one max-age directive and no repeated directives.",
    ),
    "SEC_HDR_HSTS_NO_SUBDOMAINS": CatalogEntry(
        HDR,
        LOW,
        "Strict-Transport-Security does not cover subdomains",
        "The observed header has no includeSubDomains directive. This may be intentional.",
        "Consider includeSubDomains if all subdomains support HTTPS.",
    ),
    "SEC_HDR_CSP_MISSING": CatalogEntry(
        HDR,
        MEDIUM,
        "Content-Security-Policy not observed",
        "The response did not include a Content-Security-Policy header.",
        "Add a Content-Security-Policy; start with report-only mode if needed.",
    ),
    "SEC_HDR_CSP_REPORT_ONLY": CatalogEntry(
        HDR,
        LOW,
        "Content-Security-Policy is report-only",
        "Only Content-Security-Policy-Report-Only was observed, so nothing is enforced.",
        "Promote the report-only policy to an enforcing policy.",
    ),
    "SEC_HDR_CSP_UNSAFE_INLINE": CatalogEntry(
        HDR,
        MEDIUM,
        "Content-Security-Policy allows unsafe-inline scripts",
        "The effective script source list contains 'unsafe-inline' without a nonce or hash.",
        "Use nonces or hashes instead of 'unsafe-inline'.",
    ),
    "SEC_HDR_CSP_UNSAFE_EVAL": CatalogEntry(
        HDR,
        LOW,
        "Content-Security-Policy allows unsafe-eval",
        "The effective script source list contains 'unsafe-eval'.",
        "Remove string-to-code evaluation from scripts.",
    ),
    "SEC_HDR_CSP_DATA_SOURCE": CatalogEntry(
        HDR,
        MEDIUM,
        "Content-Security-Policy allows data: scripts",
        "The effective script source list contains the data: scheme.",
        "Remove data: from script sources.",
    ),
    "SEC_HDR_FRAME_PROTECTION_MISSING": CatalogEntry(
        HDR,
        MEDIUM,
        "Clickjacking protection not observed",
        "The response had neither a CSP frame-ancestors directive nor an X-Frame-Options header.",
        "Add CSP frame-ancestors (preferred) or X-Frame-Options.",
    ),
    "SEC_HDR_XFO_INVALID": CatalogEntry(
        HDR,
        LOW,
        "X-Frame-Options value appears invalid",
        "The observed value is not DENY or SAMEORIGIN, and no frame-ancestors directive exists.",
        "Use DENY or SAMEORIGIN, or a CSP frame-ancestors directive.",
    ),
    "SEC_HDR_XCTO_MISSING": CatalogEntry(
        HDR,
        LOW,
        "X-Content-Type-Options: nosniff not observed",
        "The response did not include X-Content-Type-Options with the value nosniff.",
        "Send X-Content-Type-Options: nosniff.",
    ),
    "SEC_HDR_REFERRER_POLICY_MISSING": CatalogEntry(
        HDR,
        LOW,
        "Referrer-Policy not observed",
        "The response did not include a Referrer-Policy header.",
        "Set an explicit Referrer-Policy.",
    ),
    "SEC_HDR_PERMISSIONS_POLICY_MISSING": CatalogEntry(
        HDR,
        LOW,
        "Permissions-Policy not observed",
        "The response did not include a Permissions-Policy header.",
        "Set a Permissions-Policy that disables unused browser features.",
    ),
    "SEC_COOKIE_NO_SECURE": CatalogEntry(
        COOKIE,
        MEDIUM,
        "Cookies without the Secure attribute observed",
        "Cookies set over HTTPS did not carry the Secure attribute.",
        "Add the Secure attribute to these cookies.",
    ),
    "SEC_COOKIE_NO_HTTPONLY": CatalogEntry(
        COOKIE,
        LOW,
        "Cookies without the HttpOnly attribute observed",
        "Cookies did not carry the HttpOnly attribute.",
        "Add HttpOnly unless scripts must read the cookie.",
    ),
    "SEC_COOKIE_NO_SAMESITE": CatalogEntry(
        COOKIE,
        LOW,
        "Cookies without the SameSite attribute observed",
        "Cookies did not carry a SameSite attribute.",
        "Set SameSite=Lax or SameSite=Strict explicitly.",
    ),
    "SEC_COOKIE_SAMESITE_NONE_INSECURE": CatalogEntry(
        COOKIE,
        MEDIUM,
        "SameSite=None cookies without Secure observed",
        "Cookies with SameSite=None must also be Secure or user agents may ignore them.",
        "Add Secure or change the SameSite value.",
    ),
    "SEC_COOKIE_PREFIX_VIOLATION": CatalogEntry(
        COOKIE,
        LOW,
        "Cookie name prefix requirements not met",
        "Cookies named with __Secure- or __Host- did not meet the prefix requirements.",
        "Meet the prefix requirements or drop the prefix.",
    ),
    "SEC_CORS_WILDCARD_ORIGIN": CatalogEntry(
        CORS,
        LOW,
        "CORS allows any origin",
        "Access-Control-Allow-Origin was observed as *. This is often intentional for public data.",
        "Restrict to the origins that need access if the resource is not public.",
    ),
    "SEC_CORS_WILDCARD_WITH_CREDENTIALS": CatalogEntry(
        CORS,
        LOW,
        "CORS wildcard combined with credentials",
        "Access-Control-Allow-Origin * and Access-Control-Allow-Credentials true were observed "
        "together. Browsers do not share credentialed responses in this case.",
        "List explicit origins instead of *.",
    ),
    "SEC_CORS_NULL_ORIGIN": CatalogEntry(
        CORS,
        MEDIUM,
        "CORS allows the null origin",
        "Access-Control-Allow-Origin was observed as null.",
        "Do not allow the null origin.",
    ),
    "SEC_REDIRECT_NO_HTTPS": CatalogEntry(
        REDIRECT,
        HIGH,
        "No redirect from HTTP to HTTPS observed",
        "The plain HTTP request was answered with content instead of a redirect to HTTPS.",
        "Redirect all HTTP traffic to HTTPS.",
    ),
    "SEC_REDIRECT_NOT_PERMANENT": CatalogEntry(
        REDIRECT,
        LOW,
        "HTTP to HTTPS redirect is not permanent",
        "The redirect to HTTPS used a temporary status code.",
        "Use a permanent redirect (301 or 308) once the setup is stable.",
    ),
    "SEC_REDIRECT_TO_HTTP": CatalogEntry(
        REDIRECT,
        MEDIUM,
        "HTTP redirect stays on HTTP",
        "The Location header of the HTTP response does not point to an https URL.",
        "Redirect to the https URL.",
    ),
    "SEC_REDIRECT_OFF_HOST": CatalogEntry(
        REDIRECT,
        LOW,
        "HTTP redirect points to another host",
        "The redirect to HTTPS targets a different host. This may be intentional.",
        "Confirm the target host is expected.",
    ),
    "SEC_TLS_CERT_EXPIRED": CatalogEntry(
        TLS,
        CRITICAL,
        "TLS certificate has expired",
        "The server certificate is past its notAfter date.",
        "Renew the certificate.",
    ),
    "SEC_TLS_CERT_EXPIRES_SOON_14": CatalogEntry(
        TLS,
        HIGH,
        "TLS certificate expires within 14 days",
        "The server certificate expires within 14 days.",
        "Renew the certificate now.",
    ),
    "SEC_TLS_CERT_EXPIRES_SOON_30": CatalogEntry(
        TLS,
        MEDIUM,
        "TLS certificate expires within 30 days",
        "The server certificate expires within 30 days.",
        "Plan the certificate renewal.",
    ),
    "SEC_TLS_CERT_NOT_YET_VALID": CatalogEntry(
        TLS,
        HIGH,
        "TLS certificate is not yet valid",
        "The server certificate notBefore date is in the future.",
        "Check the certificate and the server clock.",
    ),
    "SEC_TLS_HOSTNAME_MISMATCH": CatalogEntry(
        TLS,
        HIGH,
        "TLS certificate does not match the host",
        "The monitored host is not covered by the names in the server certificate.",
        "Issue a certificate that covers this host name.",
    ),
    "SEC_TLS_CHAIN_INVALID": CatalogEntry(
        TLS,
        HIGH,
        "TLS certificate chain is not trusted",
        "The certificate chain did not validate against the trust store.",
        "Install the full chain from a trusted certificate authority.",
    ),
    "SEC_TLS_PROTOCOL_DEPRECATED": CatalogEntry(
        TLS,
        HIGH,
        "Deprecated TLS protocol version negotiated",
        "The server negotiated TLS 1.0 or 1.1, which RFC 8996 says must not be used.",
        "Disable TLS 1.1 and below and require TLS 1.2 or newer.",
    ),
    "SEC_TLS_NO_HTTPS": CatalogEntry(
        TLS,
        HIGH,
        "HTTPS was not available",
        "A connection to the HTTPS port succeeded but the server did not complete a TLS handshake.",
        "Serve the site over HTTPS.",
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

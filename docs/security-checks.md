# Security checks catalog

Design contract for the `SECURITY_POSTURE` and `DNS_WATCH` scan kinds and for edge (WAF, CDN, anti-bot)
detection. `HTTP_PROBE` is the existing check and is unchanged by this document.

Status: **draft, Phase 0**. Values marked _(draft)_ wait for the user's confirmation. Entries marked _(unverified)_
could not be checked against a primary source when this file was written and must be re-verified before the phase
that implements them.

Adding or changing a check ID updates this file in the same change.

## 1. Principles

1. **Passive only.** Read-only GET requests, one TLS handshake, DNS queries. No payloads, fuzzing, brute force,
   port scanning, authentication attempts, or form submission.
2. **Observed, not vulnerable.** Findings describe what was observed in one response. Wording uses "observed",
   "not observed", "appears".
3. **Confidence.** `HIGH`, `MEDIUM`, `LOW`. A finding derived from an uncertain signal carries a confidence value.
   A finding derived from a deterministic signal (for example a certificate `notAfter` in the past) leaves
   confidence unset (`null`).
4. **Challenge awareness.** A WAF or bot challenge response does not describe the real site (section 9).
5. **Target scope.** Only the host of the monitor, its CNAME chain, and the DNS records of that host and its
   organizational domain.
6. **No data leaves the system.** No hostname or result is sent to a third-party service.
7. **Target-caused conditions are findings, not failures.** A scan is `FAILED` only when the check could not run
   (section 3).

## 2. Scan kinds and sub-checks

| Kind               | Sub-check ID     | Purpose                                       | Reads                               |
| ------------------ | ---------------- | --------------------------------------------- | ----------------------------------- |
| `HTTP_PROBE`       | (existing)       | Status code and response time                 | One GET, no body                    |
| `SECURITY_POSTURE` | `headers`        | Security headers                              | Headers of the HTTPS GET            |
| `SECURITY_POSTURE` | `cookies`        | Cookie flags                                  | `Set-Cookie` names and flags        |
| `SECURITY_POSTURE` | `cors`           | CORS response headers                         | Headers of the HTTPS GET            |
| `SECURITY_POSTURE` | `redirect`       | HTTP to HTTPS redirect                        | First response of one HTTP GET      |
| `SECURITY_POSTURE` | `tls`            | Certificate and protocol                      | One TLS handshake                   |
| `SECURITY_POSTURE` | `exposed_files`  | Exposed sensitive files (opt-in)              | Fixed path allowlist, bounded body  |
| `SECURITY_POSTURE` | `edge`           | WAF, CDN, anti-bot profile                    | Data already collected by the above |
| `DNS_WATCH`        | `dns_records`    | Record snapshot and diff against the baseline | A, AAAA, CNAME, NS, MX, TXT         |
| `DNS_WATCH`        | `dangling_cname` | CNAME chain resolution                        | CNAME chain                         |
| `DNS_WATCH`        | `email_auth`     | SPF, DKIM (best effort), DMARC                | TXT records                         |
| `DNS_WATCH`        | `edge`           | WAF, CDN, anti-bot hints from CNAME and NS    | Data already collected by the above |

Every sub-check records `ran` or `skipped` with a reason from this list:

| Reason                | Meaning                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| `not_enabled`         | Opt-in check not enabled for the monitor (path probes)                     |
| `not_applicable`      | Check does not apply (for example `redirect` when the monitor URL is HTTP) |
| `challenge_response`  | Response was a WAF or bot challenge; derived findings suppressed           |
| `connection_failed`   | The sub-check's own connection failed; recorded, not a scan failure        |
| `budget_exhausted`    | Request budget reached                                                     |
| `prerequisite_failed` | An earlier sub-check the current one depends on did not run                |

A failing sub-check never fails the scan. The `edge` evaluator adds no requests.

## 3. Scan result semantics

| Condition                                                                             | Result                                |
| ------------------------------------------------------------------------------------- | ------------------------------------- |
| Non-public target (SSRF validation rejects any resolved address)                      | Scan `FAILED`                         |
| DNS failure for the monitor host                                                      | Scan `FAILED`                         |
| Base connection timeout for the whole scan (no sub-check could connect)               | Scan `FAILED`                         |
| Invalid or expired certificate, no HTTPS, missing headers, NXDOMAIN on a CNAME target | Finding, scan `SUCCEEDED`             |
| One sub-check connection fails while others run                                       | Sub-check `skipped`, scan `SUCCEEDED` |

Terminal status, findings, observations, and (for `DNS_WATCH`) the baseline update are written in one transaction.
A duplicate delivery of a terminal scan writes nothing.

## 4. Budgets and intervals

All values are named constants, one location per check family. They are not derived from the 60 s `HTTP_PROBE`
interval floor.

| Constant _(draft)_                         | `SECURITY_POSTURE`                                            | `DNS_WATCH`                         |
| ------------------------------------------ | ------------------------------------------------------------- | ----------------------------------- |
| Minimum interval between scans per monitor | 3600 s                                                        | 3600 s                              |
| Per-workspace scan limit                   | to be set by the user (no default assumed)                    | to be set by the user               |
| Max HTTP requests per scan, without probes | 2 (one HTTPS GET, one HTTP GET)                               | 0                                   |
| Max TLS handshakes per scan                | 1                                                             | 0                                   |
| Max path-probe requests per scan           | size of the allowlist in section 8 (opt-in only)              | 0                                   |
| Max DNS queries per scan                   | 0                                                             | 40 _(draft)_                        |
| Redirects followed                         | 0                                                             | not applicable                      |
| Timeouts                                   | connect 5 s, read 10 s, write 5 s, pool 5 s (as `HTTP_PROBE`) | DNS timeout 5 s per query _(draft)_ |
| TLS handshake timeout                      | 10 s total _(draft)_                                          | not applicable                      |
| `User-Agent`                               | `OntaPulse-SecurityScanner/<version> (+<project url>)`        | not applicable                      |

`HTTP_PROBE` keeps its own constants (one GET, connect 5 s, read 10 s, write 5 s, pool 5 s). The `User-Agent`
names OntaPulse and never impersonates a browser. The project URL value is a configuration setting added in
Phase 2 after asking.

Every connection (HTTPS GET, HTTP GET, TLS handshake, each path probe) passes SSRF validation: resolve, require
every address to be public, connect to the validated address, never re-resolve before connecting.

## 5. Severity scale and evidence rules

| Severity   | Use                                                                            |
| ---------- | ------------------------------------------------------------------------------ |
| `LOW`      | Hardening gap or informational change with limited direct impact               |
| `MEDIUM`   | Missing protection that weakens a common defense                               |
| `HIGH`     | Observed state that likely exposes users or data, or is close to an outage     |
| `CRITICAL` | Active breakage or exposure (expired certificate, exposed secret-bearing file) |

Evidence is bounded JSON stored on the finding.

- Allowed: header names, cookie names and flags, status codes, path, signature name, certificate subject, issuer,
  `notBefore`, `notAfter`, protocol name, record names and normalized record values for DNS.
- Allowed bounded values: a CSP string up to 2 KB, a `Location` value up to 512 bytes with query string removed.
- Never stored or logged: cookie values, `Authorization` or `Set-Cookie` values, tokens, response bodies,
  file content.
- Total evidence per finding is capped at 4 KB. The worker truncates and the API re-checks the size.

## 6. Check catalog: `SECURITY_POSTURE`

Header and cookie rules apply to the final HTTPS response of the single GET and only when that response is not a
challenge (section 9).

### 6.1 Security headers (`SEC_HDR_`, category `HEADERS`)

Semantics verified against RFC 6797 (HSTS), the W3C CSP Level 3 working draft (syntax, `default-src` fallback,
`unsafe-eval`, `frame-ancestors` is ignored in `<meta>`), and MDN for `X-Frame-Options`.

| ID                                   | Severity | Condition (observed)                                                                                                         | Confidence                                                | Remediation summary                                          |
| ------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------ |
| `SEC_HDR_HSTS_MISSING`               | `MEDIUM` | HTTPS response has no `Strict-Transport-Security` header                                                                     | null                                                      | Send HSTS over HTTPS with a long `max-age`                   |
| `SEC_HDR_HSTS_SHORT_MAX_AGE`         | `LOW`    | `max-age` is present and below 15552000 s (180 days) _(draft)_ and not `0`                                                   | null                                                      | Raise `max-age` (31536000 s is common)                       |
| `SEC_HDR_HSTS_DISABLED`              | `MEDIUM` | `max-age=0` (policy removal, RFC 6797)                                                                                       | null                                                      | Remove `max-age=0` unless intentionally retiring HSTS        |
| `SEC_HDR_HSTS_INVALID`               | `LOW`    | Header present but does not match the RFC 6797 grammar, has no `max-age`, or repeats a directive                             | null                                                      | Fix header syntax; browsers ignore an invalid header         |
| `SEC_HDR_HSTS_NO_SUBDOMAINS`         | `LOW`    | Valid HSTS without `includeSubDomains` _(informational advice; may be intentional)_                                          | `LOW`                                                     | Consider `includeSubDomains` if all subdomains support HTTPS |
| `SEC_HDR_CSP_MISSING`                | `MEDIUM` | No `Content-Security-Policy` header (a `-Report-Only` header alone does not count as enforcing)                              | null                                                      | Add a CSP, start with report-only if needed                  |
| `SEC_HDR_CSP_REPORT_ONLY`            | `LOW`    | Only `Content-Security-Policy-Report-Only` is sent                                                                           | null                                                      | Promote the report-only policy to enforcing                  |
| `SEC_HDR_CSP_UNSAFE_INLINE`          | `MEDIUM` | Effective `script-src` (or `default-src` fallback) contains `'unsafe-inline'` without a nonce or hash                        | `MEDIUM` _(unverified: section 6.7.3.2 of CSP3 not read)_ | Use nonces or hashes instead of `'unsafe-inline'`            |
| `SEC_HDR_CSP_UNSAFE_EVAL`            | `LOW`    | Effective `script-src` (or `default-src` fallback) contains `'unsafe-eval'`                                                  | null                                                      | Remove string-to-code evaluation from scripts                |
| `SEC_HDR_CSP_WILDCARD_SOURCE`        | `MEDIUM` | Effective `script-src` allows `*`, `data:`, or `http:` sources _(unverified: matching rules in CSP3 section 6.7.2 not read)_ | `MEDIUM`                                                  | Restrict script sources to specific hosts                    |
| `SEC_HDR_FRAME_PROTECTION_MISSING`   | `MEDIUM` | Neither `X-Frame-Options` (`DENY` or `SAMEORIGIN`) nor a CSP `frame-ancestors` directive is present                          | null                                                      | Add `frame-ancestors` (preferred) or `X-Frame-Options`       |
| `SEC_HDR_XFO_INVALID`                | `LOW`    | `X-Frame-Options` value is not `DENY` or `SAMEORIGIN` (`ALLOW-FROM` is obsolete) and no `frame-ancestors` is present         | null                                                      | Use `DENY`/`SAMEORIGIN` or CSP `frame-ancestors`             |
| `SEC_HDR_XCTO_MISSING`               | `LOW`    | `X-Content-Type-Options` absent or not `nosniff` _(unverified: Fetch spec text not read)_                                    | null                                                      | Send `X-Content-Type-Options: nosniff`                       |
| `SEC_HDR_REFERRER_POLICY_MISSING`    | `LOW`    | No `Referrer-Policy` header _(unverified)_                                                                                   | null                                                      | Set an explicit `Referrer-Policy`                            |
| `SEC_HDR_PERMISSIONS_POLICY_MISSING` | `LOW`    | No `Permissions-Policy` header _(unverified)_                                                                                | null                                                      | Set a `Permissions-Policy` that disables unused features     |

HSTS parsing rules: directive names are case-insensitive; `max-age` may be a quoted string; the value is a
non-negative integer; directives appear at most once; only the first `Strict-Transport-Security` header counts.
`preload` is not defined by RFC 6797 and is not evaluated. HSTS received over HTTP is ignored by user agents, so
it is only evaluated on the HTTPS response.

CSP parsing rules: the header is a comma-separated list of policies, each a semicolon-separated list of
directives; names are case-insensitive; a repeated directive name keeps the first copy.

### 6.2 Cookies (`SEC_COOKIE_`, category `COOKIES`)

Semantics verified against RFC 6265 (`Secure`, `HttpOnly`) and the current `rfc6265bis` Internet-Draft
(`SameSite`, `__Host-` and `__Secure-` prefixes). RFC 6265bis is a draft, not yet an RFC: re-check status when
Phase 2 is implemented. Only cookie names and flags are read; values are discarded in memory and never stored.

| ID                                  | Severity | Condition (observed)                                                                                     | Confidence | Remediation summary                        |
| ----------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------ |
| `SEC_COOKIE_NO_SECURE`              | `MEDIUM` | A cookie set over HTTPS lacks the `Secure` attribute                                                     | null       | Add `Secure`                               |
| `SEC_COOKIE_NO_HTTPONLY`            | `LOW`    | A cookie lacks `HttpOnly`                                                                                | `LOW`      | Add `HttpOnly` unless scripts must read it |
| `SEC_COOKIE_NO_SAMESITE`            | `LOW`    | A cookie has no `SameSite` attribute (user agents apply a Lax-like default)                              | `LOW`      | Set `SameSite=Lax` or `Strict` explicitly  |
| `SEC_COOKIE_SAMESITE_NONE_INSECURE` | `MEDIUM` | `SameSite=None` without `Secure` (the draft says user agents ignore such cookies)                        | null       | Add `Secure` or change `SameSite`          |
| `SEC_COOKIE_PREFIX_VIOLATION`       | `LOW`    | Name starts with `__Secure-` without `Secure`, or `__Host-` without `Secure`, `Path=/`, or with `Domain` | null       | Meet the prefix requirements               |

Cookies that look like session or auth cookies (names matching a fixed pattern list such as `session`, `sid`,
`auth`, `token`) raise `SEC_COOKIE_NO_HTTPONLY` confidence to `MEDIUM`. The pattern list is a constant in the
worker and is part of this catalog when implemented. Evidence: cookie name and the list of missing flags.

### 6.3 HTTP to HTTPS redirect (`SEC_REDIRECT_`, category `REDIRECT`)

One GET to `http://<host>/`, redirect not followed. Only the status and the `Location` header are read.

| ID                           | Severity | Condition (observed)                                                      | Confidence | Remediation summary                  |
| ---------------------------- | -------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------ |
| `SEC_REDIRECT_NO_HTTPS`      | `HIGH`   | HTTP connect succeeds, response is 2xx, and no redirect to HTTPS is sent  | null       | Redirect all HTTP traffic to HTTPS   |
| `SEC_REDIRECT_NOT_PERMANENT` | `LOW`    | Redirect to HTTPS uses 302 or 307 instead of 301 or 308                   | `LOW`      | Use a permanent redirect once stable |
| `SEC_REDIRECT_TO_HTTP`       | `MEDIUM` | `Location` points to an `http:` URL                                       | null       | Redirect to the `https:` URL         |
| `SEC_REDIRECT_OFF_HOST`      | `LOW`    | `Location` points to a different host (informational, may be intentional) | `LOW`      | Confirm the target host is expected  |

If port 80 does not accept connections the sub-check is `skipped: connection_failed` and no finding is produced:
a closed HTTP port is not a defect. A challenge response on HTTP skips the sub-check (section 9).

### 6.4 CORS (`SEC_CORS_`, category `CORS`)

Read from the headers of the single HTTPS GET with no `Origin` request header sent, so reflected-origin
behavior cannot be observed in the first version. The request carries no credentials.

> _(unverified)_ The WHATWG Fetch standard section on the CORS protocol and credentials was not read when this
> file was written. Re-verify the wildcard-with-credentials rule against the Fetch standard before implementing.

| ID                                   | Severity | Condition (observed)                                                                    | Confidence | Remediation summary                      |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| `SEC_CORS_WILDCARD_ORIGIN`           | `LOW`    | `Access-Control-Allow-Origin: *` on the monitored URL                                   | `LOW`      | Restrict to the origins that need access |
| `SEC_CORS_WILDCARD_WITH_CREDENTIALS` | `MEDIUM` | `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` | `MEDIUM`   | Never combine; list explicit origins     |
| `SEC_CORS_NULL_ORIGIN`               | `MEDIUM` | `Access-Control-Allow-Origin: null`                                                     | `MEDIUM`   | Do not allow the `null` origin           |

A wildcard origin on a public, unauthenticated resource is often intentional; hence `LOW` and `LOW` confidence.
Reflected-origin detection needs a second request with a crafted `Origin` header and is out of scope for the
first version.

### 6.5 TLS and certificate (`SEC_TLS_`, category `TLS`)

One TLS handshake to a validated IP, with the monitor host as SNI. The expiry check is produced here once; the
domain view only displays it. Time uses UTC and an injected clock. Protocol rule verified against RFC 8996
(TLS 1.0 and 1.1 must not be used).

| ID                             | Severity   | Condition (observed)                                                           | Confidence | Remediation summary                      |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------ | ---------- | ---------------------------------------- |
| `SEC_TLS_CERT_EXPIRED`         | `CRITICAL` | `notAfter` is before now                                                       | null       | Renew the certificate                    |
| `SEC_TLS_CERT_EXPIRES_SOON_14` | `HIGH`     | `notAfter` is within 14 days _(draft)_ and not expired                         | null       | Renew the certificate                    |
| `SEC_TLS_CERT_EXPIRES_SOON_30` | `MEDIUM`   | `notAfter` is within 30 days _(draft)_ and more than 14 days away              | null       | Plan renewal                             |
| `SEC_TLS_CERT_NOT_YET_VALID`   | `HIGH`     | `notBefore` is after now                                                       | null       | Check the certificate and server clock   |
| `SEC_TLS_HOSTNAME_MISMATCH`    | `HIGH`     | Monitor host matches neither a SAN DNS name nor a wildcard SAN                 | null       | Issue a certificate that covers the host |
| `SEC_TLS_CHAIN_INVALID`        | `HIGH`     | Chain does not validate against the system trust store (including self-signed) | `MEDIUM`   | Install the full chain from a trusted CA |
| `SEC_TLS_PROTOCOL_DEPRECATED`  | `HIGH`     | Handshake negotiates TLS 1.0 or 1.1 (RFC 8996), or SSL 3.0                     | null       | Disable TLS 1.1 and below                |
| `SEC_TLS_NO_HTTPS`             | `HIGH`     | The TLS handshake to port 443 fails because the host does not speak TLS        | `MEDIUM`   | Serve the site over HTTPS                |

The handshake client offers its own supported protocol range, so only the negotiated version is observable.
Whether a server also accepts older versions is not tested: that needs extra handshakes and is out of scope.
Evidence: subject CN, issuer, `notBefore`, `notAfter`, negotiated protocol name, days remaining. Public keys,
serial numbers, and the raw certificate are not stored.

### 6.6 Challenge-aware suppression

See section 9. When the HTTPS or HTTP response is a challenge, `headers`, `cookies`, and `cors` are
`skipped: challenge_response` and `redirect` is skipped when its own response was a challenge. `tls` is not
affected: the handshake happens below the HTTP layer.

## 7. Check catalog: exposed files (`SEC_EXPOSED_`, category `EXPOSED_FILES`)

Opt-in only. See section 8 for the allowlist.

| ID                             | Severity   | Condition (observed)                                                      | Confidence | Remediation summary                               |
| ------------------------------ | ---------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------- |
| `SEC_EXPOSED_ENV_FILE`         | `CRITICAL` | `/.env` returns 200 and the bounded body matches the dotenv signature     | `HIGH`     | Remove the file from the web root, rotate secrets |
| `SEC_EXPOSED_GIT_HEAD`         | `HIGH`     | `/.git/HEAD` returns 200 and the body matches the `ref:` signature        | `HIGH`     | Block `.git` from the web root                    |
| `SEC_EXPOSED_GIT_CONFIG`       | `HIGH`     | `/.git/config` returns 200 and the body matches the `[core]` signature    | `HIGH`     | Block `.git` from the web root                    |
| `SEC_EXPOSED_PATH_STATUS_ONLY` | `LOW`      | An allowlisted path returns 200 but the body does not match the signature | `LOW`      | Verify the path is not serving sensitive content  |

Evidence: path, HTTP status, signature name. Never content. A challenge response to a path probe is recorded as
`skipped: challenge_response` for that path, not as a finding. A 200 that is a generic HTML page (single-page-app
fallback) is not a match and does not produce `SEC_EXPOSED_PATH_STATUS_ONLY` when the body starts with an HTML
doctype or `<html`.

## 8. Path-probe allowlist and opt-in

Adding a path to this list needs review. Request budget in section 4 equals the size of this list.

| Path           | Signature name | Signature (matched in at most the first 4 KB, in memory)              |
| -------------- | -------------- | --------------------------------------------------------------------- |
| `/.env`        | `dotenv`       | At least one line matching `^[A-Z][A-Z0-9_]*=` at line start          |
| `/.git/HEAD`   | `git_head`     | Body begins with `ref: refs/` or is exactly a 40-character hex string |
| `/.git/config` | `git_config`   | Contains the text `[core]`                                            |

Rules:

- GET only, no redirects followed, same SSRF validation and `User-Agent` as the posture scan.
- The body is read at most 4 KB, matched in memory, and discarded. It is never persisted or logged.
- Runs only when an `OWNER` or `ADMIN` enabled path probes for the monitor and acknowledged that they are
  authorized to test the target. The acknowledgment stores user and time. `MEMBER` cannot enable. Disabling does
  not need an acknowledgment. Otherwise the sub-check is `skipped: not_enabled`.
- Probes are not run when the `edge` evaluator already classified the main response as a challenge; each path
  response is still checked on its own.

## 9. Challenge detection and suppression

A response is classified as a **challenge** when any of the following holds (signals are fingerprints, section 10):

1. Status 403, 429, 503, or 202 together with a vendor challenge marker (a challenge-specific header such as
   `cf-mitigated: challenge`, or a vendor challenge cookie name). _(unverified: exact markers per vendor must be
   checked against vendor documentation before Phase 4)_
2. A known anti-bot challenge cookie name is set on a non-2xx response.

Effects:

- `headers`, `cookies`, `cors`: `skipped: challenge_response`, no findings from that response.
- `redirect`: skipped for its own response when the HTTP response is a challenge.
- `tls`: still runs.
- The edge profile records `challenge_observed = true` with the signals.
- Nothing is solved, retried with different headers, or bypassed.

When classification is uncertain (single weak signal), findings from that response are kept but carry
`confidence = LOW` and the finding evidence includes the key `possible_challenge = true`.

## 10. Edge detection (WAF, CDN, anti-bot): observations

Pure evaluator in the worker `domain` layer over data already collected by the posture and DNS scans. No requests
of its own. Output is an **observation**, not a finding: an edge layer is informational, not a defect.

Signals used: response header names (and for a fixed set of headers, the value class), cookie names, status code,
challenge markers, certificate issuer, CNAME and NS suffix patterns.

Observation shape (stored additively, one current profile per monitor plus the scan that produced it):

| Field                | Meaning                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `vendor`             | Vendor key from the table below                                                                      |
| `layer`              | `CDN`, `WAF`, `ANTI_BOT`                                                                             |
| `confidence`         | `HIGH` (two or more independent signal types), `MEDIUM` (one strong signal), `LOW` (one weak signal) |
| `signals`            | List of `{ type, name }` that supported the match (no values)                                        |
| `challenge_observed` | Boolean for the scan                                                                                 |

Signal types: `HEADER_NAME`, `COOKIE_NAME`, `CNAME_SUFFIX`, `NS_SUFFIX`, `CERT_ISSUER`, `STATUS_MARKER`.

Vendor fingerprint table _(unverified)_: header names, cookie names, and CNAME suffix patterns per vendor must be
taken from each vendor's own documentation when Phase 4 is written. This file lists only the vendor keys in scope
for the first version; the signal lists are filled in at Phase 4 with a source link per row.

| Vendor key         | Layer         | Signals                                 |
| ------------------ | ------------- | --------------------------------------- |
| `CLOUDFLARE`       | CDN, WAF      | to be filled from vendor docs (Phase 4) |
| `AKAMAI`           | CDN, WAF      | to be filled from vendor docs (Phase 4) |
| `FASTLY`           | CDN           | to be filled from vendor docs (Phase 4) |
| `AWS_CLOUDFRONT`   | CDN           | to be filled from vendor docs (Phase 4) |
| `AWS_WAF`          | WAF           | to be filled from vendor docs (Phase 4) |
| `IMPERVA`          | WAF, ANTI_BOT | to be filled from vendor docs (Phase 4) |
| `DATADOME`         | ANTI_BOT      | to be filled from vendor docs (Phase 4) |
| `HUMAN_PERIMETERX` | ANTI_BOT      | to be filled from vendor docs (Phase 4) |
| `VERCEL`           | CDN           | to be filled from vendor docs (Phase 4) |

Rules: a vendor needs at least one signal; weak signals alone give `LOW`. Unknown vendors are not guessed.
Detection never sends traffic designed to trigger a WAF.

## 11. Check catalog: `DNS_WATCH`

Resolver and library choice are decided in the Phase 6 prompt. Queries go through a `DnsResolver` port against
the configured public resolvers only.

### 11.1 Records and baseline (`DNS_`, category `DNS`)

Snapshot record types: `A`, `AAAA`, `CNAME`, `NS`, `MX`, `TXT` for the monitor host, plus `NS` and `MX` for the
organizational domain. Normalization before diffing: lowercase names, strip trailing dot, sort values within a
type, ignore TTL, deduplicate.

- **First snapshot is the baseline** and produces no change finding.
- Later snapshots diff against the stored baseline. The new snapshot becomes the baseline in the same transaction
  as the terminal status. A bounded change history keeps the latest 50 diffs per host _(draft)_.

| ID                         | Severity | Condition (observed)                                                                         | Confidence | Remediation summary                     |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------- | ---------- | --------------------------------------- |
| `DNS_NS_CHANGED`           | `HIGH`   | NS set differs from the baseline                                                             | null       | Confirm the change was intended         |
| `DNS_CNAME_CHANGED`        | `MEDIUM` | CNAME target differs from the baseline                                                       | null       | Confirm the change was intended         |
| `DNS_MX_CHANGED`           | `MEDIUM` | MX set differs from the baseline                                                             | null       | Confirm the change was intended         |
| `DNS_TXT_CHANGED`          | `LOW`    | TXT set differs from the baseline (SPF, DMARC, DKIM changes are reported with their own IDs) | null       | Confirm the change was intended         |
| `DNS_ADDRESS_CHANGED`      | `MEDIUM` | A or AAAA set differs and the host is not CDN-fronted                                        | `MEDIUM`   | Confirm the new address is yours        |
| `DNS_ADDRESS_CHANGED_EDGE` | `LOW`    | A or AAAA set differs and the host is CDN-fronted (edge profile or CNAME suffix)             | `LOW`      | Usually normal CDN rotation             |
| `DNS_DANGLING_CNAME`       | `HIGH`   | CNAME target does not resolve (NXDOMAIN) or resolves to no address, see below                | `MEDIUM`   | Remove the record or restore the target |

Dangling CNAME is DNS-level only: the chain is followed through DNS answers, up to 8 hops _(draft)_, and the
finding is produced when a hop returns NXDOMAIN or the final name has no address records. A body fingerprint for
takeover detection needs a separate approved design. If a transient resolver error occurs (SERVFAIL, timeout)
the sub-check is `skipped: connection_failed`, not a finding.

If A/AAAA churn is the only difference and the host is CDN-fronted, only `DNS_ADDRESS_CHANGED_EDGE` is emitted
(or nothing, if the user chooses to suppress it; _draft: emit at `LOW`_).

### 11.2 Email authentication (`EMAIL_`, category `EMAIL_AUTH`)

SPF and DMARC are evaluated against the organizational domain. Semantics verified against RFC 7208 (SPF),
RFC 6376 (DKIM), and RFC 9989 (DMARC, which obsoletes RFC 7489 together with RFC 9990 and RFC 9991).

SPF rules (RFC 7208): record must start exactly with `v=spf1`; more than one `v=spf1` record at a name is a
permanent error; terms that cost DNS queries are `include`, `a`, `mx`, `ptr`, `exists`, `redirect` (limit 10,
global across recursion); void lookups (zero answers or NXDOMAIN) limit is 2; `all` qualifiers are `+` (default),
`-`, `~`, `?`; `ptr` is not recommended.

DMARC rules (RFC 9989): record at `_dmarc.<domain>`, must start with `v=DMARC1` (case-sensitive) as the first
tag; `p` is `none`, `quarantine`, or `reject`, and a record without `p` is treated as `p=none`; `sp`, `np`
optional; `rua` optional; the `pct` tag was removed and is not evaluated; multiple valid DMARC records at one
name are all discarded; the organizational domain is found by a DNS tree walk (at most 8 queries) instead of a
public-suffix list. The tree-walk algorithm lets the worker avoid a public-suffix library; Phase 6 confirms this.

DKIM rules (RFC 6376): key record is a TXT at `<selector>._domainkey.<domain>`; `v` (if present) must be
`DKIM1` and first; `p` required, an empty `p` means revoked; `t=y` marks testing mode. Selectors cannot be
enumerated through DNS, so discovery tests a fixed small list of common selectors and is best effort.

| ID                           | Severity | Condition (observed)                                                                       | Confidence | Remediation summary                          |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------ | ---------- | -------------------------------------------- |
| `EMAIL_SPF_MISSING`          | `MEDIUM` | No `v=spf1` record at the organizational domain, and an MX record exists                   | null       | Publish an SPF record                        |
| `EMAIL_SPF_MULTIPLE`         | `HIGH`   | More than one `v=spf1` record at the same name (permanent error per RFC 7208)              | null       | Merge into one record                        |
| `EMAIL_SPF_PERMISSIVE`       | `HIGH`   | Record ends with `+all` (or a bare `all`), authorizing any sender                          | null       | Use `-all` or `~all`                         |
| `EMAIL_SPF_SOFTFAIL`         | `LOW`    | Record ends with `~all` _(informational)_                                                  | `LOW`      | Consider `-all` once stable                  |
| `EMAIL_SPF_TOO_MANY_LOOKUPS` | `MEDIUM` | Counted lookups exceed 10 while following `include` and `redirect` within the query budget | `MEDIUM`   | Reduce includes; flatten carefully           |
| `EMAIL_SPF_PTR`              | `LOW`    | Record uses the `ptr` mechanism                                                            | null       | Remove `ptr`                                 |
| `EMAIL_DMARC_MISSING`        | `MEDIUM` | No valid DMARC record found by the tree walk, and an MX record exists                      | null       | Publish a DMARC record                       |
| `EMAIL_DMARC_POLICY_NONE`    | `LOW`    | Effective policy is `none` (monitoring only)                                               | null       | Move to `quarantine` or `reject` when ready  |
| `EMAIL_DMARC_NO_REPORTING`   | `LOW`    | No `rua` tag                                                                               | null       | Add an aggregate report address              |
| `EMAIL_DMARC_MULTIPLE`       | `MEDIUM` | Multiple valid DMARC records at one name (all discarded by receivers)                      | null       | Keep one record                              |
| `EMAIL_DKIM_TESTING`         | `LOW`    | A discovered selector has `t=y`                                                            | `LOW`      | Remove the testing flag when ready           |
| `EMAIL_DKIM_REVOKED`         | `LOW`    | A discovered selector has an empty `p` value (revoked key)                                 | `LOW`      | Remove the stale record or publish a new key |

A missing DKIM selector is never a finding by itself: discovery is best effort. When the host has no MX record,
SPF and DMARC absence is not reported (a domain that sends no mail has no obligation, and the sub-check records
`not_applicable` for the missing-record IDs). A subdomain inheriting the organizational policy is not a finding.

## 12. Result storage summary (additive, implemented from Phase 1)

| Concept           | Added to                     | Notes                                                                                 |
| ----------------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `Scan.kind`       | `Scan`                       | `HTTP_PROBE` default; existing rows keep the default                                  |
| `checkId`         | finding row                  | Existing `code` stays; for new findings `code` equals `checkId`                       |
| `category`        | finding row                  | `HEADERS`, `COOKIES`, `CORS`, `REDIRECT`, `TLS`, `EXPOSED_FILES`, `DNS`, `EMAIL_AUTH` |
| `confidence`      | finding row                  | Nullable `LOW`, `MEDIUM`, `HIGH`                                                      |
| Sub-check results | scan row or child table      | `ran` or `skipped` with a reason, decided in Phase 1                                  |
| Edge observations | new table                    | Current profile per monitor plus producing scan                                       |
| DNS baseline      | new table                    | One current baseline per host plus bounded history; worker is the only writer         |
| Monitor settings  | new table or monitor columns | Enabled kinds; path-probe flag, acknowledging user, acknowledgment time               |

Exact names live in `apps/api/prisma/schema.prisma` once Phase 1 lands.

## 13. Open items for the user

1. Per-workspace limits for security and DNS scans (no default assumed).
2. Confirm the draft intervals, expiry thresholds (30 and 14 days), HSTS minimum `max-age` (180 days), DNS query
   cap (40), and CNAME hop limit (8).
3. Confirm whether CDN-fronted address churn is emitted at `LOW` or suppressed.
4. Vendor fingerprint signals and challenge markers are filled from vendor documentation at Phase 4.
5. `SEC_HDR_CSP_*` unsafe source semantics, `SEC_CORS_*` wildcard-with-credentials rules, and the Fetch standard
   `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` rules need a source read in Phase 2.
6. RFC 6265bis becomes an RFC: re-check wording of cookie rules when Phase 2 starts.

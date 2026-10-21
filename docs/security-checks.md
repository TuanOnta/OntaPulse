# Security checks catalog

Design contract for the `SECURITY_POSTURE` and `DNS_WATCH` scan kinds and for edge (WAF, CDN, anti-bot)
detection. `HTTP_PROBE` is the existing check and is unchanged by this document.

Status: **draft. Phases 2 to 4 implemented the header, cookie, CORS, redirect, TLS, and edge checks of `SECURITY_POSTURE`.** Values marked _(draft)_ wait for the user's confirmation. Entries marked _(unverified)_
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

| Kind               | Sub-check ID     | Purpose                                                           | Reads                               |
| ------------------ | ---------------- | ----------------------------------------------------------------- | ----------------------------------- |
| `HTTP_PROBE`       | (existing)       | Status code and response time                                     | One GET, no body                    |
| `SECURITY_POSTURE` | `headers`        | Security headers                                                  | Headers of the HTTPS GET            |
| `SECURITY_POSTURE` | `cookies`        | Cookie flags                                                      | `Set-Cookie` names and flags        |
| `SECURITY_POSTURE` | `cors`           | CORS response headers                                             | Headers of the HTTPS GET            |
| `SECURITY_POSTURE` | `redirect`       | HTTP to HTTPS redirect                                            | First response of one HTTP GET      |
| `SECURITY_POSTURE` | `tls`            | Certificate and protocol                                          | One TLS handshake                   |
| `SECURITY_POSTURE` | `exposed_files`  | Exposed sensitive files (opt-in)                                  | Fixed path allowlist, bounded body  |
| `SECURITY_POSTURE` | `edge`           | WAF, CDN, anti-bot profile                                        | Data already collected by the above |
| `DNS_WATCH`        | `dns_records`    | Record snapshot and diff against the baseline                     | A, AAAA, CNAME, NS, MX, TXT         |
| `DNS_WATCH`        | `dangling_cname` | CNAME chain resolution                                            | CNAME chain                         |
| `DNS_WATCH`        | `email_auth`     | SPF, DKIM (best effort), DMARC                                    | TXT records                         |
| `DNS_WATCH`        | `edge`           | WAF, CDN, anti-bot hints from CNAME and NS (not built in Phase 6) | Data already collected by the above |

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

| Constant _(draft)_                                   | `SECURITY_POSTURE`                                            | `DNS_WATCH`                       |
| ---------------------------------------------------- | ------------------------------------------------------------- | --------------------------------- |
| Manual re-run cooldown per monitor                   | 60 s                                                          | 60 s _(Phase 6)_                  |
| Minimum interval between scheduled scans per monitor | 3600 s                                                        | 3600 s                            |
| Per-workspace scan limit                             | 60 per hour                                                   | 60 per hour _(Phase 6)_           |
| Max HTTP requests per scan, without probes           | 2 (one HTTPS GET, one HTTP GET)                               | 0                                 |
| Max TLS handshakes per scan                          | 1                                                             | 0                                 |
| Max path-probe requests per scan                     | size of the allowlist in section 8 (opt-in only)              | 0                                 |
| Max DNS queries per scan                             | 0                                                             | 40                                |
| Redirects followed                                   | 0                                                             | not applicable                    |
| Timeouts                                             | connect 5 s, read 30 s, write 5 s, pool 5 s (as `HTTP_PROBE`) | DNS 2 s per server, 5 s per query |
| TLS handshake timeout                                | 10 s per socket operation                                     | not applicable                    |
| `User-Agent`                                         | `OntaPulse-SecurityScanner/<version> (+<project url>)`        | not applicable                    |

`HTTP_PROBE` keeps its own constants (one GET, connect 5 s, read 30 s, write 5 s, pool 5 s). The `User-Agent`
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

Phase 2 verification notes: `X-Content-Type-Options` (only `nosniff` is valid, MDN), `Referrer-Policy` (valid tokens
and the W3C default), `Permissions-Policy` (structured-field dictionary, W3C). The CSP3 text read does not define when
`'unsafe-inline'` is ignored because of a nonce or hash, nor how `*`, `data:`, or `http:` match in `script-src`;
therefore `'unsafe-inline'` is reported only when no nonce, hash, or `'strict-dynamic'` source is present (confidence
`LOW`), and wildcard and `http:` sources are not evaluated. `data:` is evaluated because CSP3 says developers should not
include it. `rfc6265bis` is still an Internet-Draft (12 October 2026 revision).

Header and cookie rules apply to the final HTTPS response of the single GET and only when that response is not a
challenge (section 9).

### 6.1 Security headers (`SEC_HDR_`, category `HEADERS`)

Semantics verified against RFC 6797 (HSTS), the W3C CSP Level 3 working draft (syntax, `default-src` fallback,
`unsafe-eval`, `frame-ancestors` is ignored in `<meta>`), and MDN for `X-Frame-Options`.

| ID                                   | Severity | Condition (observed)                                                                                                                                    | Confidence | Remediation summary                                          |
| ------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------ |
| `SEC_HDR_HSTS_MISSING`               | `MEDIUM` | HTTPS response has no `Strict-Transport-Security` header                                                                                                | null       | Send HSTS over HTTPS with a long `max-age`                   |
| `SEC_HDR_HSTS_SHORT_MAX_AGE`         | `LOW`    | `max-age` is present and below 15552000 s (180 days) _(draft)_ and not `0`                                                                              | null       | Raise `max-age` (31536000 s is common)                       |
| `SEC_HDR_HSTS_DISABLED`              | `MEDIUM` | `max-age=0` (policy removal, RFC 6797)                                                                                                                  | null       | Remove `max-age=0` unless intentionally retiring HSTS        |
| `SEC_HDR_HSTS_INVALID`               | `LOW`    | Header present but does not match the RFC 6797 grammar, has no `max-age`, or repeats a directive                                                        | null       | Fix header syntax; browsers ignore an invalid header         |
| `SEC_HDR_HSTS_NO_SUBDOMAINS`         | `LOW`    | Valid HSTS without `includeSubDomains` _(informational advice; may be intentional)_                                                                     | `LOW`      | Consider `includeSubDomains` if all subdomains support HTTPS |
| `SEC_HDR_CSP_MISSING`                | `MEDIUM` | Neither `Content-Security-Policy` nor `Content-Security-Policy-Report-Only` is present                                                                  | null       | Add a CSP, start with report-only if needed                  |
| `SEC_HDR_CSP_REPORT_ONLY`            | `LOW`    | Only `Content-Security-Policy-Report-Only` is present (nothing is enforced; reported instead of `SEC_HDR_CSP_MISSING`)                                  | null       | Promote the report-only policy to enforcing                  |
| `SEC_HDR_CSP_UNSAFE_INLINE`          | `MEDIUM` | Effective `script-src` (or `default-src` fallback) contains `'unsafe-inline'` and the same source list has no nonce, hash, or `'strict-dynamic'` source | `LOW`      | Use nonces or hashes instead of `'unsafe-inline'`            |
| `SEC_HDR_CSP_UNSAFE_EVAL`            | `LOW`    | Effective `script-src` (or `default-src` fallback) contains `'unsafe-eval'`                                                                             | null       | Remove string-to-code evaluation from scripts                |
| `SEC_HDR_CSP_DATA_SOURCE`            | `MEDIUM` | Effective `script-src` (or `default-src` fallback) contains the `data:` scheme source (CSP3 says developers should not include it)                      | `MEDIUM`   | Remove `data:` from script sources                           |
| `SEC_HDR_FRAME_PROTECTION_MISSING`   | `MEDIUM` | Neither `X-Frame-Options` (`DENY` or `SAMEORIGIN`) nor a CSP `frame-ancestors` directive is present                                                     | null       | Add `frame-ancestors` (preferred) or `X-Frame-Options`       |
| `SEC_HDR_XFO_INVALID`                | `LOW`    | `X-Frame-Options` value is not `DENY` or `SAMEORIGIN` (`ALLOW-FROM` is obsolete) and no `frame-ancestors` is present                                    | null       | Use `DENY`/`SAMEORIGIN` or CSP `frame-ancestors`             |
| `SEC_HDR_XCTO_MISSING`               | `LOW`    | `X-Content-Type-Options` is absent, or its value is not `nosniff` (the only valid value)                                                                | null       | Send `X-Content-Type-Options: nosniff`                       |
| `SEC_HDR_REFERRER_POLICY_MISSING`    | `LOW`    | No `Referrer-Policy` header (the W3C default without it is `no-referrer-when-downgrade`)                                                                | null       | Set an explicit `Referrer-Policy`                            |
| `SEC_HDR_PERMISSIONS_POLICY_MISSING` | `LOW`    | No `Permissions-Policy` header (value is a structured-field dictionary; presence only is evaluated)                                                     | null       | Set a `Permissions-Policy` that disables unused features     |

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

Verified against the WHATWG Fetch standard (CORS protocol and credentials): with credentials mode `include`,
`Access-Control-Allow-Origin` cannot be `*`; the only valid `Access-Control-Allow-Credentials` value is the
case-sensitive `true`; `null` is a valid `Access-Control-Allow-Origin` value.

| ID                                   | Severity | Condition (observed)                                                                                                                                                                                            | Confidence | Remediation summary                      |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------- |
| `SEC_CORS_WILDCARD_ORIGIN`           | `LOW`    | `Access-Control-Allow-Origin: *` on the monitored URL                                                                                                                                                           | `LOW`      | Restrict to the origins that need access |
| `SEC_CORS_WILDCARD_WITH_CREDENTIALS` | `LOW`    | `Access-Control-Allow-Origin: *` together with `Access-Control-Allow-Credentials: true` (Fetch: a credentialed request cannot use `*`, so browsers will not share the response; observed as a misconfiguration) | `MEDIUM`   | Never combine; list explicit origins     |
| `SEC_CORS_NULL_ORIGIN`               | `MEDIUM` | `Access-Control-Allow-Origin: null`                                                                                                                                                                             | `MEDIUM`   | Do not allow the `null` origin           |

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

Implemented in Phase 3 as the `tls` sub-check of `SECURITY_POSTURE`:

- **One handshake with full verification** (`CERT_REQUIRED`, hostname check on). After a verified handshake the
  certificate subject, issuer, `notBefore`, `notAfter`, and the negotiated protocol are read. When verification
  fails the certificate is **not** parsed (the standard library cannot read an unverified certificate in the same
  handshake), so the finding carries the OpenSSL verify code and message, not an expiry date.
- **Verify code mapping** (values from OpenSSL 3.0 `x509_vfy.h`, confirmed by live handshakes in the tests): 10 expired
  -> `SEC_TLS_CERT_EXPIRED`; 9 not yet valid -> `SEC_TLS_CERT_NOT_YET_VALID`; 62 hostname mismatch ->
  `SEC_TLS_HOSTNAME_MISMATCH`; every other failure (18 self-signed, 19, 20, 21, ...) -> `SEC_TLS_CHAIN_INVALID`. OpenSSL
  reports the first error it finds, so a certificate with two defects yields one finding.
- **Protocol observation:** the scanner's probe context accepts TLS 1.0 and later (`minimum_version = TLSv1`,
  `DEFAULT:@SECLEVEL=0`) while still verifying the certificate, so a server whose best version is TLS 1.0 or 1.1 is
  observed. A server that also supports TLS 1.2 or 1.3 negotiates the better version and is not flagged. SSL 3.0 cannot
  be negotiated by this runtime and is therefore never observed. Nothing is sent after the handshake.
- **`SEC_TLS_NO_HTTPS`:** the TCP connection succeeded but the handshake failed with a non-certificate SSL error (for
  example `WRONG_VERSION_NUMBER`). A refused or timed-out connection is not a finding; the sub-check is
  `skipped: connection_failed`.
- **Expiry bands:** exactly 14 days left is the 14-day band, exactly 30 days is the 30-day band, zero seconds left is
  expired. Days are computed in UTC with an injected clock.
- **Timeouts:** TCP connect 5 s; 10 s applies to each socket operation of the handshake (not a total deadline).
- **`HTTP_PROBE` and certificates:** a probe whose target certificate does not verify still ends `FAILED`, but its stored
  message now says why: "Certificate does not match the host name" (verify code 62), "Certificate has expired" (10),
  "Certificate is not yet valid" (9), or "Certificate is not trusted" (any other). The full TLS findings come only from a
  security scan.
- **Port:** the port of the derived HTTPS URL. The scan is `FAILED` only when neither request nor the handshake could
  connect; a TLS result alone keeps a scan alive (an HTTPS GET that fails on a bad certificate is explained by the
  TLS finding).

Evidence: subject CN, issuer organization or CN, `notBefore`, `notAfter`, negotiated protocol name, days remaining, and
for verification failures the verify code and message (200 characters at most). Public keys, serial numbers, and the raw
certificate are not stored or logged.

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

Signature sources (read 2026-10-20): the `ref: refs/some/thing` symref format is from the git glossary (`symref`), and
a detached HEAD holds an object name directly; object names are 40 hex digits (SHA-1) or 64 (SHA-256) per the git
hash function transition document, so both lengths match. `[core]` is the section syntax of the git config file
(`git-config`). The `dotenv` signature is a heuristic: no specification of `.env` files exists.

| Path           | Signature name | Signature (matched in at most the first 4 KB, in memory)                                                            |
| -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `/.env`        | `dotenv`       | At least one line matching `^[A-Z][A-Z0-9_]*=` at line start                                                        |
| `/.git/HEAD`   | `git_head`     | Body begins with `ref: refs/` or is exactly a 40 or 64 character lowercase hex string (trailing whitespace ignored) |
| `/.git/config` | `git_config`   | Contains the text `[core]`                                                                                          |

Rules:

- GET only, no redirects followed, same SSRF validation and `User-Agent` as the posture scan.
- The body is read at most 4 KB, matched in memory, and discarded. It is never persisted or logged.
- Runs only when an `OWNER` or `ADMIN` enabled path probes for the monitor and acknowledged that they are
  authorized to test the target. The acknowledgment stores user and time. `MEMBER` cannot enable. Disabling does
  not need an acknowledgment and clears the stored acknowledgment, so re-enabling needs a fresh one. The worker runs
  the probes only when the setting is enabled **and** an acknowledgment time is stored. Otherwise the sub-check is
  `skipped: not_enabled`.
- Probes are sent to `https://<monitor host>[:port]<path>` with no query string, `Accept-Encoding: identity`, and the
  scanner `User-Agent`. Each probe resolves the host once and connects to the validated address.
- A 200 whose body starts with an HTML doctype or `<html` is a single-page-app fallback and produces no finding.
- Probes are not run when the main HTTPS response was a confirmed challenge (`skipped: challenge_response`); each path
  response is still checked on its own, and a probe response that is itself a confirmed challenge is dropped for that
  path. Probe responses are never fed to the edge evaluator.

Sub-check `exposed_files` states: `ran` when at least one probe produced a usable response; `skipped: not_enabled`
(off, or enabled without a stored acknowledgment); `skipped: challenge_response`; `skipped: prerequisite_failed` when
the main HTTPS request could not connect; `skipped: connection_failed` when every probe failed to connect. A failing
probe never fails the scan. With probes enabled a scan makes at most 2 requests, 3 probes, and 1 TLS handshake.

## 9. Challenge detection and suppression

A response is classified as a **challenge** when any of the following holds (signals are fingerprints, section 10):

1. A verified vendor challenge marker. Cloudflare: the response header `cf-mitigated` with the value `challenge`
   (the documented only value; set for all Challenge Page types; the documentation names no status code). AWS WAF
   (Phase 4, AWS documentation): the response header `x-amzn-waf-action` with the value `challenge` (status 202) or
   `captcha` (status 405). Markers for other vendors are added only after the same primary-source verification.
2. Heuristic, low certainty: status 403, 429, or 503 without a verified marker. Findings from such a response are
   kept with `confidence = LOW` and `possible_challenge = true` in the evidence.
3. A known anti-bot challenge cookie is set on a non-2xx response (Phase 4): `datadome` (DataDome) or `_pxhd`
   (HUMAN). The same `datadome` cookie on a 2xx response is not a challenge.

Effects:

- `headers`, `cookies`, `cors`: `skipped: challenge_response`, no findings from that response.
- `redirect`: skipped for its own response when the HTTP response is a challenge.
- `tls`: still runs.
- The edge profile records `challenge_observed = true` with the signals.
- Nothing is solved, retried with different headers, or bypassed.

When classification is uncertain (single weak signal), findings from that response are kept but carry
`confidence = LOW` and the finding evidence includes the key `possible_challenge = true`.

## 10. Edge detection (WAF, CDN, anti-bot): observations

Pure evaluator in the worker `domain` layer (`modules/edge_detection`) over data already collected by the posture
scan. No requests of its own (Phase 4). Output is an **observation**, not a finding: an edge layer is informational,
not a defect. Wording is "observed": a vendor header proves that vendor's edge was in the path, not that a rule set is
enabled.

Signals used in Phase 4: response header names (and, for the fixed rows below, a header value class), cookie names,
status class, and challenge markers. The input model also accepts certificate issuer, CNAME suffix, and NS suffix, but
no table row uses them yet: no primary-source patterns were verified, and DNS data arrives in Phase 6.

Observation shape (one current profile per monitor plus the scan that produced it, table `MonitorEdgeProfile`):

| Field                | Meaning                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `vendor`             | Vendor key from the table below                                                                             |
| `layer`              | `CDN`, `WAF`, `ANTI_BOT`                                                                                    |
| `confidence`         | `HIGH` (two or more independent signal types), `MEDIUM` (one `STRONG` signal), `LOW` (only `WEAK` signals)  |
| `signals`            | List of `{ type, name }` that supported the match (no values); a signal seen in both responses counts once  |
| `challenge_observed` | Boolean for the scan (profile level): at least one response classified as a confirmed challenge (section 9) |

An empty `detections` list means "no edge layer observed in this scan" and replaces an older profile. A vendor can
appear under several layers when each has its own supporting signals.

Signal types: `HEADER_NAME`, `COOKIE_NAME`, `CERT_ISSUER`, `CNAME_SUFFIX`, `NS_SUFFIX`, `STATUS_MARKER`
(`CERT_ISSUER`, `CNAME_SUFFIX`, and `NS_SUFFIX` have no rules yet). `STATUS_MARKER` is a verified challenge or
mitigation marker header value. Strength `S` = `STRONG`, `W` = `WEAK`.

Fingerprint table, read from each vendor's own documentation on 2026-10-20. Signals found only in third-party
write-ups are not used.

| Vendor key         | Layer      | Signal                                                | Type          | Str | Source                                                                                                            |
| ------------------ | ---------- | ----------------------------------------------------- | ------------- | --- | ----------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE`       | `CDN`      | header `cf-ray`                                       | HEADER_NAME   | S   | developers.cloudflare.com/fundamentals/reference/http-headers/                                                    |
| `CLOUDFLARE`       | `CDN`      | header `cf-cache-status`                              | HEADER_NAME   | W   | developers.cloudflare.com/cache/concepts/cache-responses/ (cache decision header)                                 |
| `CLOUDFLARE`       | `WAF`      | header `cf-mitigated` = `challenge`                   | STATUS_MARKER | S   | Cloudflare challenge documentation (verified in Phase 2)                                                          |
| `AWS_CLOUDFRONT`   | `CDN`      | header name starting `x-amz-cf-`                      | HEADER_NAME   | S   | docs.aws.amazon.com CloudFront "Understand response headers policies" (reserved `X-Amz-Cf-.*` family)             |
| `AWS_CLOUDFRONT`   | `CDN`      | header `server` equal to `CloudFront`                 | HEADER_NAME   | W   | same page: the `Server` value CloudFront adds is `CloudFront`; an origin may also send `Server`                   |
| `AWS_WAF`          | `WAF`      | header `x-amzn-waf-action` = `challenge` or `captcha` | STATUS_MARKER | S   | docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html (Challenge 202, CAPTCHA 405) |
| `VERCEL`           | `CDN`      | header `x-vercel-id`                                  | HEADER_NAME   | S   | vercel.com/docs/headers/response-headers                                                                          |
| `VERCEL`           | `CDN`      | header `server` equal to `Vercel`                     | HEADER_NAME   | W   | same page: can be overridden by other proxies                                                                     |
| `FASTLY`           | `CDN`      | header `x-served-by` with a value starting `cache-`   | HEADER_NAME   | S   | fastly.com/documentation/reference/http/http-headers/X-Served-By/ (`cache-{datacenter}{nodeid}-{datacenter}`)     |
| `DATADOME`         | `ANTI_BOT` | cookie `datadome` set on a non-2xx response           | COOKIE_NAME   | S   | docs.datadome.co/reference/validate-request (`Set-Cookie: datadome=...` returned with a challenge)                |
| `DATADOME`         | `ANTI_BOT` | cookie `datadome` set on a 2xx response               | COOKIE_NAME   | W   | same page: the module also sets the cookie on allowed responses, so it shows presence, not a challenge            |
| `DATADOME`         | `ANTI_BOT` | header `x-dd-b`                                       | HEADER_NAME   | W   | same page lists it in an example response; its meaning is not defined there                                       |
| `HUMAN_PERIMETERX` | `ANTI_BOT` | cookie `_pxhd`                                        | COOKIE_NAME   | S   | docs.humansecurity.com/applications/use-of-cookies-web-storage (HTTP cookie for server-side detection)            |
| `HUMAN_PERIMETERX` | `ANTI_BOT` | cookie name starting `_px`                            | COOKIE_NAME   | W   | same page: the `_px*` family is set by JavaScript, so a `Set-Cookie` match is unlikely                            |
| `AKAMAI`           | -          | none                                                  | -             | -   | not detected in this version: no primary source found                                                             |
| `IMPERVA`          | -          | none                                                  | -             | -   | not detected in this version: no primary source found                                                             |

Rules: a vendor needs at least one signal; weak signals alone give `LOW`. Unknown vendors are not guessed. Detection
never sends traffic designed to trigger a WAF. Values are matched in memory (lowercased, trimmed, exact or prefix) and
never stored or logged. At most 16 detections and 8 signals per detection are kept, and the stored profile is capped at
8 KB.

## 11. Check catalog: `DNS_WATCH`

Queries go through a `DnsResolver` port against the configured public resolvers only (Phase 6).

Phase 6 decisions:

- **Library and resolvers:** `dnspython` (core package only) with `configure=False`; the resolver list is the `DNS_RESOLVERS`
  setting (default `1.1.1.1,8.8.8.8,9.9.9.9`). Every address must be public: a private, loopback, or link-local address is
  rejected at startup, so an internal resolver can never be used. UDP with the library's TCP fallback, no DoH. The monitor host
  name and its organizational domain are visible to those resolvers as DNS queries; no result is sent anywhere.
- **Query plan (at most 40 per scan, a named constant):** host `A`, `AAAA`, `CNAME`, `NS`, `MX`, `TXT` (6); organizational domain `NS`,
  `MX`, `TXT` (3); the DMARC tree walk (at most 8); the CNAME chain (at most 8 hops); SPF `include` and `redirect` lookups (at most
  10); DKIM selectors (at most 5). When the budget is reached the remaining sub-check is `skipped: budget_exhausted`. Timeouts: 2 s per
  server and 5 s per query. A transient failure (timeout, SERVFAIL) for one record type marks that type unknown; an unknown type is
  never diffed, so a failed query never produces a change finding.
- **Organizational domain without a public-suffix library:** the DMARC tree walk of RFC 9989 section 4.10: query `_dmarc.<name>`
  walking from the host toward the root, at most 8 queries; a name with more than 8 labels has its leftmost labels removed until 7
  remain; the organizational domain is the name with the fewest labels that holds a DMARC record (a `psd=n` record wins). When no
  DMARC record exists on the walk the fallback is the last two labels of the host. For a multi-label public suffix (for example
  `co.uk`) the fallback yields the suffix itself, which has no `MX` record, so the missing-record findings stay silent
  (`not_applicable`). This limitation is accepted.
- **Snapshot (normalized: lowercase, trailing dot stripped, TTL ignored, values sorted and deduplicated):**
  `{ host: { name, A, AAAA, CNAME, NS, MX, TXT }, organization: { name, NS, MX } }`. `MX` values are `<preference> <host>`; a TXT
  record made of several strings is joined.
- **Result semantics:** the scan is `FAILED` only when the monitor host cannot be resolved at all (`NXDOMAIN` for the host itself, or
  every resolver unreachable), with the generic message "The host name could not be resolved". Sub-check names: `dns_records`,
  `dangling_cname`, `email_auth`.
- **Evidence:** change findings carry the record type and the `added` and `removed` normalized values, each list capped at 20 values of
  255 characters, 4 KB in total. TXT values can hold verification tokens; they are bounded and never logged.

### 11.1 Records and baseline (`DNS_`, category `DNS`)

Snapshot record types: `A`, `AAAA`, `CNAME`, `NS`, `MX`, `TXT` for the monitor host, plus `NS` and `MX` for the
organizational domain. Normalization before diffing: lowercase names, strip trailing dot, sort values within a
type, ignore TTL, deduplicate.

- **First snapshot is the baseline** and produces no change finding.
- Later snapshots diff against the stored baseline. The new snapshot becomes the baseline in the same transaction
  as the terminal status. A bounded change history keeps the latest 50 diffs per monitor; a history row is written only when
  something changed. A `FAILED` scan never touches the baseline, and an older scan never overwrites a newer baseline.
  "CDN-fronted" means the monitor's current edge profile (Phase 4) has a `CDN` detection; without one the host is treated as not
  CDN-fronted. CDN-fronted A/AAAA churn is emitted as `DNS_ADDRESS_CHANGED_EDGE` at `LOW`.

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
public-suffix list. The tree-walk algorithm lets the worker avoid a public-suffix library; Phase 6 confirms this and adds the
two-label fallback described above.

DKIM rules (RFC 6376): key record is a TXT at `<selector>._domainkey.<domain>`; `v` (if present) must be
`DKIM1` and first; `p` required, an empty `p` means revoked; `t=y` marks testing mode. Selectors cannot be
enumerated through DNS, so discovery tests a fixed small list of selectors and is best effort. The list (read 2026-10-20, each
from the provider's own documentation): `google` (Google Workspace default prefix selector), `selector1` and `selector2`
(Microsoft 365, published as CNAME records that resolve to the key), `s1` and `s2` (Twilio SendGrid domain authentication, also
CNAME records). Mailchimp was left out: no primary source was found. A query for the selector name is a `TXT` query; a CNAME answer
is followed by the resolver.

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

A revoked key (`EMAIL_DKIM_REVOKED`) is reported only for a domain that accepts mail: a domain that sends no mail legitimately
publishes a wildcard revoked key (`*._domainkey` with `p=` empty, as `example.com` does), which found during the Phase 6 live check.
A missing DKIM selector is never a finding by itself: discovery is best effort. When the host has no MX record,
SPF and DMARC absence is not reported (a domain that sends no mail has no obligation, and the sub-check records
`not_applicable` for the missing-record IDs). A subdomain inheriting the organizational policy is not a finding.

## 12. Result storage summary (additive, implemented from Phase 1)

| Concept           | Added to                       | Notes                                                                                             |
| ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------- |
| `Scan.kind`       | `Scan`                         | `HTTP_PROBE` default; existing rows keep the default                                              |
| `checkId`         | finding row                    | Existing `code` stays; for new findings `code` equals `checkId`                                   |
| `category`        | finding row                    | `HEADERS`, `COOKIES`, `CORS`, `REDIRECT`, `TLS`, `EXPOSED_FILES`, `DNS`, `EMAIL_AUTH`             |
| `confidence`      | finding row                    | Nullable `LOW`, `MEDIUM`, `HIGH`                                                                  |
| Sub-check results | scan row or child table        | `ran` or `skipped` with a reason, decided in Phase 1                                              |
| Edge observations | `MonitorEdgeProfile` (Phase 4) | One current profile per monitor plus producing scan; worker writes it in the terminal transaction |
| DNS baseline      | new table                      | One current baseline per host plus bounded history; worker is the only writer                     |
| Monitor settings  | new table or monitor columns   | Enabled kinds; path-probe flag, acknowledging user, acknowledgment time                           |

Phase 2 added `Scan.subChecks` (nullable JSON list of `{ name, state, reason }`; `NULL` for `HTTP_PROBE`),
the `GET`/`PATCH` `/api/monitors/:monitorId/check-settings` routes, the trigger rules for `SECURITY_POSTURE`
(enabled per monitor, 60 s manual cooldown per monitor, 60 scans per hour per workspace; the 3600 s minimum applies to scheduled runs), and
`GET /api/monitors/:monitorId/security-posture/latest`. Phase 1 added `Scan.kind`, the finding columns `checkId`, `category`, and `confidence`, and the
`MonitorCheckSettings` table (`securityPostureEnabled`, `dnsWatchEnabled`, `pathProbesEnabled`,
`pathProbesAcknowledgedById`, `pathProbesAcknowledgedAt`; no row means all disabled). `HTTP_PROBE` findings keep
`checkId`, `category`, and `confidence` as `NULL`. Sub-check results, edge observations, and the DNS baseline are
added in the phases that use them. Phase 6 made `DNS_WATCH` runnable (`dnsWatchEnabled` per monitor, 60 s manual cooldown, 60 scans per
hour per workspace), added the tables `DnsBaseline` (one row per monitor) and `DnsChange` (history), and the routes
`GET /api/monitors/:monitorId/dns-watch/latest` (`404 NO_DNS_SCAN`) and `GET /api/monitors/:monitorId/dns-baseline` (`404
NO_DNS_BASELINE`); the worker is the only writer. Phase 5 made `PATCH /monitors/:id/check-settings` accept `pathProbesEnabled` with
`pathProbesAcknowledged` (`400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED` without it) and stores `pathProbesAcknowledgedById`
and `pathProbesAcknowledgedAt`; the worker reads the setting when it claims the scan. Phase 4 added the `MonitorEdgeProfile` table (`monitorId` unique, `scanId`,
`challengeObserved`, `detections` JSON, `observedAt`), the sub-check name `edge`, and
`GET /api/monitors/:monitorId/edge-profile` (any member; `404 NO_EDGE_PROFILE` before the first posture scan).
Exact names live in `apps/api/prisma/schema.prisma`.

## 13. Open items for the user

1. Per-workspace limits: 60 scans per hour for both kinds (confirmed in Phase 6).
2. Confirm the draft intervals, expiry thresholds (30 and 14 days), HSTS minimum `max-age` (180 days), DNS query
   cap (40, confirmed in Phase 6), and CNAME hop limit (8).
3. Confirm whether CDN-fronted address churn is emitted at `LOW` or suppressed.
4. Akamai and Imperva fingerprints need a primary vendor source; until then they are not detected (section 10).
5. `SEC_HDR_CSP_*` unsafe source semantics, `SEC_CORS_*` wildcard-with-credentials rules, and the Fetch standard
   `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy` rules need a source read in Phase 2.
6. RFC 6265bis becomes an RFC: re-check wording of cookie rules when Phase 2 starts.

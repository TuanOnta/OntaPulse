# Phase 0 — Security checks design (docs only)

Branch: `security/phase-0-security-checks-design`. No code, no schema, no tests. Apps touched: docs only.

## 1. Goal

Write the design contract the later phases (1 to 7) build against:

- Create `docs/security-checks.md`: the check catalog (IDs, categories, severities, thresholds, confidence rules,
  remediation text), request budgets, minimum intervals, path allowlist, vendor fingerprints, challenge rules.
- Update `docs/architecture.md`: scan kinds, new domain concepts, worker modules, data flow.
- Update `docs/queue-contract.md`: scan kind is read from the `Scan` row, payload unchanged, idempotency for
  findings and DNS baseline, result semantics for partial sub-checks.

## 2. References read

- Root `AGENTS.md` (sections 1, 7, 8, 9, 10, 12, 16), `apps/api/AGENTS.md`, `apps/worker/AGENTS.md`,
  `apps/web/AGENTS.md`.
- `docs/architecture.md`, `docs/queue-contract.md` in full (current text quoted below).
- `apps/api/prisma/schema.prisma` (`Scan`, `ScanFinding`, `FindingSeverity`, `ScanOutboxEvent`).

## 3. Existing code inspected

- API: `Scan` has no `kind`; `ScanFinding` has `code`, `title`, `severity`, `description`, `recommendation`,
  `evidence Json?` and no `checkId`, category, or confidence. `FindingSeverity` already has `LOW..CRITICAL`.
- Architecture doc states an **in-process API scheduler** already claims due monitors every 10 s via
  `nextScheduledAt` and `intervalSeconds`. Phase 7 must inspect this code first; Phase 0 only records the
  constraint that security and DNS scans use their own minimum interval, not the 60 s floor.
- Worker: `modules/scans/...` lifecycle only; no `http_probe`, `security_posture`, `dns_watch`, or
  `edge_detection` modules yet (the layout in `apps/worker/AGENTS.md` is the target, not the current tree).
- Worker `adapters/http` holds the SSRF validator (`url_security`), to be extended per connection type in later
  phases.

## 4. Discrepancies to resolve (veto any)

| Finding                                                                                                   | Proposal                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AGENTS.md says prototypes live in `reference/`; the repo folder is `references/`.                         | Leave the folder alone (read-only). Docs refer to the real path. Tell the user so AGENTS.md can be corrected in the design chat.                                |
| Existing `ScanFinding.code` vs. planned `checkId`.                                                        | Catalog documents `checkId` as an additive column; `code` stays for `HTTP_PROBE` findings and mirrors `checkId` for new ones, so existing readers keep working. |
| Architecture doc says "web client is the next implementation milestone"; the web client is largely built. | Update that status sentence (docs only, same change).                                                                                                           |

## 5. Contract changes (documented now, implemented later)

Documented only; nothing is changed in code. Sync list for later phases: api (Prisma migration, routes), worker
(dispatch, checks), web (phase 8+). All additive and backward compatible.

- `Scan.kind`: `HTTP_PROBE` (default) | `SECURITY_POSTURE` | `DNS_WATCH`.
- `ScanFinding`: `checkId`, `category`, `confidence` (nullable), bounded sanitized `evidence`.
- Observation / edge profile, DNS baseline plus bounded change history, monitor check settings (enabled kinds,
  path-probe opt-in with acknowledging user and time).
- Queue payload stays `{ scanId, monitorId }`. Topology unchanged. Retry rules unchanged.

## 6. Content plan for `docs/security-checks.md`

1. **Principles**: passive only, observed wording, confidence, challenge awareness (link to AGENTS.md section 8).
2. **Scan kinds and sub-checks**: per kind, the list of sub-checks, each with `ran` / `skipped` + reason values.
3. **Budgets**: per kind, max requests, fixed paths, timeouts (reuse connect 5 s, read 10 s, write 5 s, pool 5 s),
   `User-Agent` format naming OntaPulse, minimum interval, per-workspace limit. All as named constants.
4. **Catalog tables** (ID, category, severity, trigger condition, confidence, evidence stored, remediation text):
   - `SEC_HDR_*`: CSP missing / unsafe, HSTS missing / short max-age / no includeSubDomains, X-Frame-Options /
     frame-ancestors, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.
   - `SEC_COOKIE_*`: missing Secure, HttpOnly, SameSite (names and flags only).
   - `SEC_TLS_*`: expired, expiring (thresholds), hostname mismatch, weak protocol version, chain problem.
   - `SEC_REDIRECT_*`: no HTTP to HTTPS redirect (first response, not followed), non-permanent redirect.
   - `SEC_CORS_*`: wildcard origin, wildcard with credentials, reflected origin (observed from one request only).
   - `SEC_EXPOSED_*`: allowlisted paths with signature names, opt-in only.
   - `DNS_*`: record changed vs baseline, dangling CNAME, A/AAAA churn on CDN-fronted hosts.
   - `EMAIL_*`: SPF missing / permissive / too many lookups, DKIM (best effort, never a finding by absence alone),
     DMARC missing / `p=none` / missing reporting.
5. **Severity and threshold rules** in one table per family; certificate expiry thresholds with UTC and injected
   clock semantics.
6. **Path-probe allowlist**: fixed paths, signature names, 4 KB body cap, evidence = path + status + signature name.
7. **Edge detection fingerprints**: header names, cookie names, status, challenge markers, certificate issuer,
   CNAME/NS patterns per vendor class (WAF, CDN, anti-bot); confidence model; stored as observation with signals.
8. **Challenge rules**: which responses count as a challenge; which findings are suppressed vs low confidence.
9. **DNS rules**: normalization (lowercase, sorted, TTL ignored), baseline-first-run, CDN churn handling,
   dangling CNAME is DNS-level only, organizational-domain lookup for SPF / DMARC, resolver list as config.
10. **Evidence and redaction rules** and size bounds (CSP up to 2 KB; total evidence cap).
11. **Change process**: adding or changing an ID updates this file in the same change.

## 7. Decisions needing the user's approval

These values are proposals; the doc will state them as drafts until confirmed.

| Item                                 | Proposal                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Minimum interval, `SECURITY_POSTURE` | 3600 s                                                                                                 |
| Minimum interval, `DNS_WATCH`        | 3600 s                                                                                                 |
| Request budget, posture              | 2 requests (1 HTTPS GET, 1 HTTP GET) plus 1 TLS handshake; path probes add up to N fixed paths, opt-in |
| Per-workspace limit                  | to be set from the catalog; user supplies a number or accepts a default                                |
| Certificate expiry thresholds        | warn at 30 days (`MEDIUM`), 14 days (`HIGH`), expired (`CRITICAL`)                                     |
| DNS library / public-suffix library  | Not added in Phase 0. Phase 6 prompt will ask (for example `dnspython`).                               |
| Resolver hosts                       | Config values only; defaults chosen in the Phase 6 prompt.                                             |

## 8. Security-semantics verification

Header meaning, cookie attributes, TLS rules, SPF, DKIM, DMARC, and CSP rules are written only after reading the
current spec text (RFC 6797, RFC 7208, RFC 6376, DMARC current RFC, W3C CSP, RFC 6265 and its current revision)
and vendor docs for fingerprints. If a spec cannot be fetched, the doc says which entries are unverified. Nothing
is written from memory.

## 9. Safety review (for the design)

- Requests per scan and paths are fixed and listed in the catalog; no redirects followed.
- Only headers, cookie names / flags, and bounded non-secret values are read; bodies only for opt-in path probes
  (4 KB, discarded).
- SSRF validation is required for every connection type, connect to the validated IP, no re-resolve.
- Path probes need `OWNER` or `ADMIN` plus recorded acknowledgment. No hostname leaves the system.

## 10. Files likely to change

- `docs/security-checks.md` (new)
- `docs/architecture.md` (scan kinds, domain model, worker modules, status sentence)
- `docs/queue-contract.md` (kind read from row, idempotency, result semantics)
- `prompts/phase-0-security-checks-design.md` (Result section at the end)

## 11. Acceptance criteria

- Every `checkId` prefix from AGENTS.md section 7 has entries with severity, condition, confidence, evidence,
  remediation.
- Budgets, minimum intervals, and thresholds are tables of named constants.
- Queue payload and topology sections are unchanged; only additive notes are added.
- `HTTP_PROBE` behavior is documented as unchanged.
- No code, schema, lockfile, or `references/` file is modified.

## 12. Checks to run

- `pnpm format:check`
- `git diff --check`

(No app checks: docs only.)

## 13. Manual test steps

1. Open `docs/security-checks.md`; confirm each prefix has a table and every ID appears once.
2. Confirm `docs/queue-contract.md` payload block is identical to before.
3. `git status`: only the files in section 10 changed.
4. Review the draft values in section 7 and confirm or change them.

## 14. Security requirements

No secrets, no real hostnames in examples (use `example.com`). Evidence samples contain no cookie values or body
content.

## Result

Done on branch `security/phase-0-security-checks-design`. Docs only.

- Created `docs/security-checks.md` (catalog, budgets, intervals, allowlist, challenge rules, DNS and email rules).
- Updated `docs/architecture.md` (planned security features, domain additions, worker families, data flow, web status sentence) and `docs/queue-contract.md` (kind read from the Scan row, security-scan consumer rules). Payload and topology unchanged.

Verified against sources: RFC 6797, RFC 7208, RFC 6376, RFC 9989 (obsoletes RFC 7489), RFC 6265, RFC 6265bis draft, RFC 8996, MDN X-Frame-Options, W3C CSP3 (partial).

Not verified (marked _(unverified)_ in the catalog): CSP `unsafe-inline` and wildcard matching rules, WHATWG Fetch CORS credentials rules, `X-Content-Type-Options` / `Referrer-Policy` / `Permissions-Policy` rules, vendor fingerprints and challenge markers, and the tail of the long RFC texts (only the first 100000 characters were read).

Checks: `prettier --check` on the four changed files passes. `git diff --check` clean. Repo-wide `pnpm format:check` fails on 244 files, mostly `references/*.html` and others unrelated to this change; not touched.

Draft values awaiting the user: see section 13 of `docs/security-checks.md`.

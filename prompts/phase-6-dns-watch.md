# Phase 6 — DNS and domain watch

Apps touched: docs, api, worker. Web: none (the domain and DNS panel is a later web phase, built from the design system).
Branch if approved: `feat/dns-watch`, cut from an up-to-date `main` (see D1).

## 1. Goal

Make the `DNS_WATCH` scan kind runnable. One scan queries the monitor host and its organizational domain through public
resolvers and produces:

1. **Record snapshot and change detection** against a per-monitor baseline (first snapshot is the baseline, later ones diff).
2. **Dangling CNAME** (DNS-level only).
3. **Email authentication**: SPF, DMARC, and best-effort DKIM findings.
4. Read endpoints for the latest DNS scan and for the baseline with its recent changes.

Certificate expiry is not repeated here (the TLS check owns it). Not in this phase: web UI, recurring runs (Phase 7), edge detection
from DNS data (D10), body-fingerprint takeover detection, notifications. `HTTP_PROBE` and `SECURITY_POSTURE` are unchanged.

## 2. References read

- Root `AGENTS.md` (sections 1, 2, 4, 6, 7, 8, 9, 10, 12, 13, 16), `apps/api/AGENTS.md`, `apps/worker/AGENTS.md`.
- `docs/security-checks.md` (sections 1 to 5, 9 to 13), `docs/queue-contract.md`, `docs/architecture.md`.
- `prompts/phase-4-edge-detection.md` and `phase-5-path-probes.md` (Result sections: how settings and profiles reach the worker).
- Specs: RFC 9989 section 4.10 (DNS Tree Walk) read for this prompt; RFC 7208 (SPF), RFC 6376 (DKIM) and the DMARC details are re-read
  at implementation, as the catalog requires.
- dnspython on PyPI and its resolver documentation (read 2026-10-20).

## 3. Existing code inspected

API:

- `scan-kinds.ts`: `AVAILABLE_SCAN_KINDS = ["HTTP_PROBE", "SECURITY_POSTURE"]` (`DNS_WATCH` rejected with `SCAN_KIND_NOT_AVAILABLE`);
  `SCAN_KIND_LIMITS` only has `SECURITY_POSTURE`.
- `scan.service.ts` `trigger()`: role check, kind availability, per-kind limits, and an enabled check that already reads
  `checkSettings.dnsWatchEnabled` for non-posture kinds (error code `SECURITY_CHECKS_DISABLED`).
- `check-settings`: `PATCH` already accepts `dnsWatchEnabled`. `scan.routes.ts` has `GET /monitors/:id/security-posture/latest`; the
  `edge-profile` module is the template for a small read module. No DNS tables exist in `schema.prisma`.

Worker:

- `scans/application/scan_lifecycle.py` dispatches by kind through a registry built in `bootstrap/container.py`; non-`HTTP_PROBE` executors
  receive `ScanOptions` (Phase 5). `ScanResult` carries `findings`, `sub_checks`, `edge_profile`. `SqlAlchemyScanRepository.succeed()` writes
  status, `subChecks`, edge profile, and findings in one transaction (the pattern for the baseline).
- `scans/adapters/http/url_security.py` and `security_posture/adapters/pinned_address.py` use `socket.getaddrinfo` (system resolver) for
  connection targets; they stay as they are. There is **no** DNS client, no `DnsResolver` port, and `dnspython` is not in `uv.lock`.
- `platform/config.py`: Pydantic Settings with `DATABASE_URL` and `RABBITMQ_URL` only.
- `edge_detection` evaluator accepts `cname_targets` and `ns_targets`, with no rules for them yet (Phase 4, D6).

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Git first.** `feat/path-probes` (PR #12) is not merged and `feat/path-probes-ui` holds uncommitted work. I cut `feat/dns-watch` from `main` only after you decide what to merge or commit; I will not branch on a dirty tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D2  | **New dependency (needs your approval): `dnspython` 2.9.0** (ISC license, `requires-python >=3.11`, no runtime dependencies without extras; PyPI, read 2026-10-20). Why: the standard library cannot query `TXT`, `NS`, `MX`, or `CNAME` records or talk to a chosen resolver. Only the core package is used (no `doh`, `dnssec`, or `trio` extras). `uv.lock` changes; I run the full workspace tests. The alternative is a hand-written DNS client, which I recommend against.                                                                                                                                                                                                                                                                                                              |
| D3  | **Resolvers (needs your approval, including a privacy trade-off).** New setting `DNS_RESOLVERS` (comma-separated IPs) in Pydantic Settings and `.env.example` together. Default: `1.1.1.1,8.8.8.8,9.9.9.9`. Every address must be public (the validator rejects private, loopback, and link-local addresses, so an internal resolver can never be configured). dnspython runs with `configure=False` and the list as `nameservers`, so the OS resolver is never used. UDP with the library's TCP fallback; no DoH. **Trade-off:** the monitor host name and its organizational domain are visible to those public resolvers as DNS queries; that is inherent to DNS and is what safety rule 11 prescribes, but it is the one place a host name leaves the system. No result is sent anywhere. |
| D4  | **Organizational domain without a public-suffix library.** Derived with the **DMARC tree walk of RFC 9989 section 4.10**: query `_dmarc.<name>` walking from the host toward the root, at most 8 queries; with more than 8 labels the leftmost labels are removed until 7 remain; the organizational domain is the name with the fewest labels that has a DMARC record (a `psd=n` record wins). **Fallback** when no DMARC record exists on the walk: the last two labels of the host. For a multi-label suffix (for example `co.uk`) that yields the suffix itself, which has no `MX`, so the missing-record findings stay silent (`not_applicable`) and no false finding appears; this limitation is written in the catalog. No `tldextract` or similar library.                            |
| D5  | **Queries per scan: at most 40** (catalog draft, confirmed here), a named constant with an ordered plan: host `A`, `AAAA`, `CNAME`, `NS`, `MX`, `TXT` (6); organizational domain `NS`, `MX`, `TXT` (3, or reused when the domain equals the host); DMARC walk (at most 8); dangling CNAME chain (at most 8 hops); SPF `include`/`redirect` lookups (at most 10, RFC 7208 limit); DKIM selectors (fixed list, at most 6). A budget counter stops further queries with `skipped: budget_exhausted` for the remaining sub-check. Timeouts 2 s per server and 5 s per query lifetime. No retries beyond the next configured resolver.                                                                                                                                                             |
| D6  | **Snapshot shape (normalized, TTL ignored, lowercase, trailing dot stripped, values sorted and deduplicated):** `{ host: { name, A, AAAA, CNAME, NS, MX, TXT }, organization: { name, NS, MX } }`. `MX` is stored as `preference host`; a multi-string `TXT` is joined. A record type with no answer is an empty list; a transient failure for one type marks that type unknown, and an unknown type is never diffed (no finding from a failed query).                                                                                                                                                                                                                                                                                                                                        |
| D7  | **Storage (additive migration):** `DnsBaseline` (one row per monitor: `monitorId` unique, `scanId`, `host`, `organizationDomain`, `snapshot` JSON, `observedAt`) and `DnsChange` (history: `monitorId`, `scanId`, `observedAt`, `changes` JSON; the worker keeps the latest 50 per monitor and prunes in the same transaction). The worker is the only writer; the API only reads. Snapshot and changes JSON are bounded (16 KB) in the worker and re-checked in the API.                                                                                                                                                                                                                                                                                                                     |
| D8  | **Baseline rules:** the first successful scan stores the baseline and creates **no** change finding. Later scans diff against it, insert the findings, replace the baseline, and add one `DnsChange` row **only when something changed**, all in the same transaction as the terminal status. A `FAILED` scan never touches the baseline. The upsert guard (`observedAt` not older) from the edge profile pattern prevents an older scan from overwriting a newer baseline. A duplicate delivery writes nothing (terminal scans are not re-run).                                                                                                                                                                                                                                              |
| D9  | **Change findings (catalog 11.1):** `DNS_NS_CHANGED` (HIGH), `DNS_CNAME_CHANGED` (MEDIUM), `DNS_MX_CHANGED` (MEDIUM), `DNS_TXT_CHANGED` (LOW; SPF/DMARC/DKIM changes keep their own IDs where they are evaluated), `DNS_ADDRESS_CHANGED` (MEDIUM, confidence MEDIUM) and `DNS_ADDRESS_CHANGED_EDGE` (LOW, confidence LOW). Evidence: record type, `added` and `removed` normalized values, each capped (20 values, 255 characters), 4 KB total. TXT values can hold verification tokens; they are bounded and never logged.                                                                                                                                                                                                                                                                   |
| D10 | **CDN-fronted detection** for address churn uses the **current edge profile of the monitor** (a `CDN` detection from Phase 4, read by the worker when the scan starts). If none exists the host is treated as not CDN-fronted. The `edge` sub-check of `DNS_WATCH` and CNAME/NS suffix rules stay **out of this phase**: they need vendor-verified patterns and a decision on how a DNS-derived profile merges with the response-derived one.                                                                                                                                                                                                                                                                                                                                                 |
| D11 | **Dangling CNAME (DNS-level only):** follow the CNAME chain up to 8 hops; `DNS_DANGLING_CNAME` (HIGH, confidence MEDIUM) when a hop is `NXDOMAIN` or the final name has no `A`/`AAAA`; a transient error (timeout, SERVFAIL) is `skipped: connection_failed`, never a finding. No provider list and no body fingerprint.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D12 | **Email authentication (catalog 11.2):** SPF is parsed and counted (lookups, void lookups, `all` qualifier, `ptr`, multiple records) but never evaluated against a sender; DMARC uses the tree walk result and the RFC 9989 rules (first tag `v=DMARC1`, `p` missing means `none`, multiple records discarded); DKIM tests a small fixed selector list and a missing selector is never a finding. Missing-record findings need an `MX` record at the organizational domain, otherwise `not_applicable`. The selector list is a documented heuristic (each entry with its provider source, verified at implementation; unverifiable entries are dropped).                                                                                                                                      |
| D13 | **API trigger:** add `DNS_WATCH` to `AVAILABLE_SCAN_KINDS` and `SCAN_KIND_LIMITS` with named constants: manual cooldown **60 s** and **60 scans per hour per workspace** (same as posture; catalog open item 1 asked you for the number), minimum scheduled interval 3600 s (used in Phase 7). Role rule unchanged (`OWNER`/`ADMIN`), disabled monitor `409` (error code `SECURITY_CHECKS_DISABLED` is kept for compatibility, with a DNS-specific message).                                                                                                                                                                                                                                                                                                                                  |
| D14 | **New read routes (additive):** `GET /api/monitors/:monitorId/dns-watch/latest` (newest finished `DNS_WATCH` scan with findings and `subChecks`; `404 NO_DNS_SCAN`) and `GET /api/monitors/:monitorId/dns-baseline` (`{ monitorId, scanId, host, organizationDomain, observedAt, snapshot, changes: [{ scanId, observedAt, changes }] }`; `404 NO_DNS_BASELINE`). Any member can read; outsiders and unknown monitors get `404 MONITOR_NOT_FOUND`.                                                                                                                                                                                                                                                                                                                                            |
| D15 | **Scan result semantics:** the scan is `FAILED` only when the monitor host cannot be resolved at all (`NXDOMAIN` for the host itself, or every resolver unreachable); the stored message is generic ("The host name could not be resolved"). Everything else is a finding or a `skipped` sub-check. Sub-check names: `dns_records`, `dangling_cname`, `email_auth`. One failing sub-check never fails the scan.                                                                                                                                                                                                                                                                                                                                                                               |
| D16 | **Worker layout:** `modules/dns_watch/{domain,application,adapters}`: domain (normalization, diff, SPF/DMARC/DKIM parsing, dangling rules, catalog constants, tree-walk name builder) is pure; application holds the `DnsResolver` and `DnsBaselineReader` ports and `DnsWatchExecutor`; adapters hold the dnspython resolver and the SQLAlchemy baseline reader. `ScanOptions` gains `monitor_id`; `ScanResult` gains `dns_outcome` (snapshot, changes) that `succeed()` persists.                                                                                                                                                                                                                                                                                                           |

## 5. Contract changes and sync list

| Contract                 | Change                                                                                                                                   | Apps        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Prisma / migrations      | New tables `DnsBaseline` and `DnsChange` (additive migration `add_dns_baseline`); no change to existing tables                           | api, worker |
| Routes                   | `DNS_WATCH` accepted by `POST /monitors/:id/scans`; new `GET .../dns-watch/latest` and `GET .../dns-baseline`; existing routes unchanged | api, (web)  |
| Queue payload / topology | **None** (`{ scanId, monitorId }`; the kind and settings are read from the database)                                                     | none        |
| Env / settings           | New `DNS_RESOLVERS` (Pydantic Settings and `.env.example` together)                                                                      | worker      |
| Dependencies             | `dnspython` 2.9.0 in the worker (`pyproject.toml`, `uv.lock`)                                                                            | worker      |
| Docs                     | Catalog sections 2, 4, 11, 12, 13; `architecture.md`; `queue-contract.md`; `development.md` (the new setting)                            | docs        |

Order: docs, API migration and routes, worker. Web later.

## 6. Files likely to change

API: `prisma/schema.prisma` + migration, `scan-kinds.ts`, `scan.service.ts` (message only), new `modules/domain-watch/` (routes, controller,
service, repository, schema, openapi; the name follows `apps/api/AGENTS.md`), `app.ts`, tests (`test/domain-watch.test.ts`,
a regression line for `HTTP_PROBE`).

Worker: new `modules/dns_watch/...` (about 12 files), `platform/config.py`, `bootstrap/container.py` (resolver, executor, registry entry),
`scans/domain/models.py` (`ScanOptions.monitor_id`, `DnsOutcome`), `scans/application/scan_lifecycle.py`, `scans/adapters/sqlalchemy_scan_repository.py`
(baseline upsert, change insert, prune), `pyproject.toml`, `uv.lock`, tests mirroring each path; `.env.example`.

Docs as listed. Not touched: web, `reference/`, the posture and `HTTP_PROBE` code beyond the shared options field.

## 7. Implementation requirements

1. Docs first: record the D4 limitation, the query budget, snapshot shape, and the new IDs in the catalog; add the selector list with sources.
2. API: migration reviewed by hand and additive; Zod and JSON Schema identical; repository is the only Prisma caller; service re-checks the JSON size.
3. Worker `DnsResolver` port: `query(name, type) -> RecordSet | Nxdomain | NoData | TransientError`, implemented with dnspython `Resolver(configure=False)`;
   the settings validator rejects non-public resolver addresses; one budget object shared by all sub-checks.
4. Pure evaluators, table-driven with fixture record sets: normalization, snapshot diff (including unknown types), SPF parser and lookup counter,
   DMARC parser and tree-walk name builder (more than 8 labels), DKIM parser, dangling chain.
5. Executor order: host records and org domain, DMARC walk, SPF, DKIM, dangling CNAME; each sub-check `ran` or `skipped` with a catalog reason.
6. `succeed()` writes status, `subChecks`, findings, baseline upsert, and the `DnsChange` row and pruning in one transaction.
7. Logging: counts, record types, sub-check states only; never TXT values or record contents.

## 8. Safety review (scanner phase)

- **Requests per scan and to whom:** at most 40 DNS queries to the configured public resolvers (D3), none to the target. No HTTP, no TLS, no
  connection to the monitored host. SSRF validation for connections is not involved, but the resolver list itself is validated public.
- **Read from responses:** DNS record values of the monitor host and its organizational domain, and the DMARC and DKIM records under them.
- **Stored:** the normalized snapshot and bounded change evidence (record types and values, capped); findings. **Not stored or logged:** query
  logs of values, raw packets, anything about hosts other than the monitor host, its CNAME chain, and its organizational domain.
- **Scope (rule 2):** only the monitor host, its CNAME chain, the organizational domain, and the DMARC walk names above it. The walk stops before
  the root, and the fallback never queries a top-level domain on its own.
- **Data leaving the system (rule 12):** the host and organizational domain names appear in queries to the public resolvers. Flagged in D3 for your approval.
- **Opt-in:** `dnsWatchEnabled` per monitor, set by `OWNER`/`ADMIN` (existing control). DNS is public data and no acknowledgment is required.
- **Wording:** "observed", never "vulnerable". DKIM discovery is best effort and a missing selector is never a finding.

## 9. Acceptance criteria

- `POST /monitors/:id/scans {"kind":"DNS_WATCH"}` is `202` for `OWNER`/`ADMIN` when enabled; `409` when disabled; `403` for `MEMBER`; `404` for outsiders;
  `429` inside the cooldown or over the hourly limit; `HTTP_PROBE` and `SECURITY_POSTURE` triggers and responses unchanged.
- First successful scan: a baseline row, no change finding. Second scan with a changed record: exactly one change finding of the right ID, the baseline
  replaced, one `DnsChange` row; an unchanged second scan: no finding and no `DnsChange` row.
- A transient failure for one record type produces no change finding for that type. CDN-fronted address churn yields only `DNS_ADDRESS_CHANGED_EDGE`.
- Dangling CNAME, SPF (missing, multiple, `+all`, `~all`, too many lookups, `ptr`), DMARC (missing, `p=none`, no `rua`, multiple), and DKIM (`t=y`, empty `p`)
  findings from fixture record sets; missing-record findings stay silent without an `MX`.
- At most 40 queries per scan; a budget stop yields `skipped: budget_exhausted`; resolver addresses that are private are rejected at startup.
- A duplicate delivery of a terminal scan writes no second baseline, change row, or finding set; a `FAILED` scan leaves the baseline untouched.
- Read routes return the described shapes with role and `404` isolation tests; unknown or oversized JSON is sanitized.
- Worker coverage stays above 85; API thresholds unchanged; `HTTP_PROBE` tests unedited.

## 10. Checks to run

`pnpm --filter @ontapulse/api exec prisma generate --config prisma7.config.ts`, `pnpm --filter @ontapulse/api test:db:migrate`, `moon run api:typecheck`,
`moon run api:test`, `moon run worker:sync`, `moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`, worker coverage via
`uv run --locked --no-sync coverage run -m pytest -m "not integration"` then `coverage report`, `pnpm format:check` (touched files), `git diff --check`.
`worker:integration-test` hangs on this machine; run it with a time limit or report it as not run. The new SQL is also run against the dedicated test database.

## 11. Manual test steps

1. `docker compose up -d`, `docker compose ps`; `pnpm --filter @ontapulse/api exec prisma migrate deploy`; `moon run worker:sync`; set `DNS_RESOLVERS` (or keep the default);
   start `moon run api:dev`, `moon run worker:dev`.
2. For a monitor on a domain **you own**: `PATCH /api/monitors/<id>/check-settings` `{"dnsWatchEnabled":true}`; `POST /api/monitors/<id>/scans` `{"kind":"DNS_WATCH"}` -> `202`.
3. `GET /api/monitors/<id>/dns-baseline` -> the snapshot with no changes; `GET .../dns-watch/latest` -> `subChecks` `dns_records`, `dangling_cname`, `email_auth` and any
   `EMAIL_*` findings for your domain.
4. Change a harmless `TXT` record on your domain, wait for the cache, scan again: one `DNS_TXT_CHANGED` finding, the baseline updated, one change in the history.
5. Scan again without changes: no new finding, no new history row. Redeliver a job from the RabbitMQ UI: nothing changes.
6. Roles: `MEMBER` gets `403` on trigger and `200` on both reads; an outsider gets `404` everywhere; disabled monitor `409`.
7. Worker log: query counts and record types only, no record values. Never point this at a domain you do not own.

## 12. Security requirements

No secrets in code or logs; resolvers validated public; input validated at the route boundary; authorization in the service; `404` isolation on every route; JSON bounded in
the worker and re-checked in the API; no record values in logs; the scan stays passive (DNS queries only).

## 13. Questions for you

1. **D2 and D3:** approve the `dnspython` dependency, the `DNS_RESOLVERS` setting with default `1.1.1.1,8.8.8.8,9.9.9.9`, and the fact that the monitor host name is visible to those public resolvers?
2. **D4:** accept the tree walk with the two-label fallback (no public-suffix library), or do you want a public-suffix library instead?
3. **D13 and D1:** the 60 s cooldown and 60 per hour per workspace for DNS scans, and how to handle the current git state (merge PR #12, commit or discard `feat/path-probes-ui`) before I cut the branch?

## What I could not verify while writing this prompt

- The second half of RFC 9989 (the `psd` details and sections after 4.10) and RFC 7208 and RFC 6376 text: re-read at implementation.
- The DKIM selector list sources (provider documentation): verified at implementation, and any entry without a primary source is dropped.
- dnspython behaviour with the TCP fallback and `NoNameservers` under real resolver failures: tested with fakes only until a manual run.

## Result

Implemented on branch `feat/dns-watch`, stacked on `feat/path-probes-ui` (PRs #12 and the path probes UI are not merged yet, so this branch contains their commits until they are). All questions were answered with the recommended defaults: `dnspython` 2.9.0 and `DNS_RESOLVERS` (default `1.1.1.1,8.8.8.8,9.9.9.9`) approved, tree walk with the two-label fallback, 60 s cooldown and 60 per hour for DNS. Web UI is a separate branch (`feat/dns-watch-ui`). Not pushed.

What changed:

- Docs: `docs/security-checks.md` (section 11 decisions, budget table, verified DKIM selector list with sources, section 12), `architecture.md`, `development.md`, `.env.example`.
- API: migration `20261020120000_add_dns_baseline` (`DnsBaseline`, `DnsChange`), `DNS_WATCH` available with `SCAN_KIND_LIMITS` (60 s, 60 per hour), a DNS specific `409` message, `GET /monitors/:id/dns-watch/latest` (`404 NO_DNS_SCAN`) and `GET /monitors/:id/dns-baseline` (`404 NO_DNS_BASELINE`, new `domain-watch` module with a sanitizer for the stored JSON).
- Worker: `modules/dns_watch` (pure domain: normalization, snapshot and diff, SPF, DMARC tree walk, DKIM, findings; application: `DnsWatchExecutor`, query budget; adapters: dnspython resolver, SQLAlchemy store), `DNS_RESOLVERS` setting that rejects non-public addresses, baseline upsert, history row and pruning in the terminal transaction, `ScanOptions.monitor_id`.

Verification of specs (read 2026-10-20): RFC 9989 section 4.10 (tree walk), RFC 7208 (version section, 10 lookup terms, default `+`, `redirect` ignored when `all` exists), RFC 7505 (null MX `0 .`), dnspython documentation (`configure=False`, `nameservers`, exceptions), and the provider documents for the DKIM selectors (`google`, `selector1`, `selector2`, `s1`, `s2`; Mailchimp dropped, no primary source).

Findings during testing, fixed:

- Evidence trimming dropped a whole entry when a single change was large; it now trims values first and never returns empty evidence.
- A live run against `example.com` (public resolvers, DNS queries only) showed `*._domainkey` wildcard revoked keys: `EMAIL_DKIM_REVOKED` is now reported only for a domain that accepts mail.
- A dangling CNAME makes the address queries answer `NXDOMAIN`; the host CNAME is queried first so that case is a finding, not a failed scan.
- An exhausted query budget now skips `email_auth` instead of producing findings from incomplete data.

Checks run: `worker:lint`, `worker:format-check` pass; worker tests all pass, coverage 96.06% (floor 85); `api:typecheck` pass; API vitest 230 passed in 15 files (two old tests that assumed `DNS_WATCH` was unavailable now expect `409 SECURITY_CHECKS_DISABLED`); prettier clean on the touched docs. The new SQL (baseline upsert with the `observedAt` guard, history insert, pruning to 50, CDN detection read, cascade) was run against the dedicated `ontapulse_test` database. A live run of the executor against `example.com` through the public resolvers confirmed the adapter, the tree walk, and the snapshot.

Not verified:

- A scan through the real API, queue, and worker, and a real baseline change between two scans (needs a domain you own; the diff logic is covered by fakes and the SQL by the test database).
- `worker:integration-test` (hangs on this machine) and `api:coverage` (failed its thresholds before this change).
- The web UI (next branch).
- Resolver failure behaviour under real packet loss: only fakes and one live success path were exercised.

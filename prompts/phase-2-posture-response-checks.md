# Phase 2 — Posture A: response-based checks

Apps touched: docs, api, worker. Web: none (screens are blocked until prototypes exist). Branch name if used:
`security/phase-2-posture-response-checks` (Phase 1 was implemented on `master` at the user's request; the user
chooses again for this phase, see section 4, D1).

## 1. Goal

First real `SECURITY_POSTURE` scan, using only the response headers of two plain requests:

- Security headers (`SEC_HDR_*`), cookie flags (`SEC_COOKIE_*`), CORS (`SEC_CORS_*`) from one HTTPS GET.
- HTTP to HTTPS redirect (`SEC_REDIRECT_*`) from the first response of one HTTP GET, redirect not followed.
- Enable/disable per monitor, trigger rules (role, enabled, minimum interval, workspace limit), and read endpoints.

Not in this phase: TLS and certificate (Phase 3), edge/WAF detection (Phase 4), path probes (Phase 5), DNS (Phase 6),
recurring runs (Phase 7), any web UI. `HTTP_PROBE` is unchanged.

## 2. References read

- Root `AGENTS.md` (sections 7, 8, 10, 12, 16), `apps/api/AGENTS.md`, `apps/worker/AGENTS.md`.
- `docs/security-checks.md` (sections 2 to 6, 9), `docs/queue-contract.md`, `prompts/phase-1-scan-kind-plumbing.md`.

## 3. Existing code inspected

Worker:

- `adapters/http/http_scan_executor.py`: `httpx.Client` with `follow_redirects=False`, timeouts 5/10/5/5, `stream("GET")`
  without reading the body; `PublicTargetUrlValidator` resolves with `getaddrinfo` and checks `is_global`.
  **Observed gap:** `HTTP_PROBE` validates the addresses and then lets httpx resolve the host again when it
  connects. Root rule 3 forbids that for new checks (DNS rebinding). This phase does not touch `HTTP_PROBE`
  (unchanged-behavior rule); the gap is reported to the user as a separate decision (D2).
- Installed `httpx 0.28.1` and `httpcore 1.0.9` (`uv.lock`): httpcore passes the request extension `sni_hostname`
  as `server_hostname` when wrapping the socket (`httpcore/_sync/connection.py`, line 151), so a request to
  `https://<validated-ip>/` with a `Host` header and `extensions={"sni_hostname": host}` connects to the validated
  address and still verifies the certificate against the monitor host.
- `application/scan_lifecycle.py` (Phase 1): `executors` mapping exists; `HTTP_PROBE` results always pass through
  `evaluate_scan_result` (adds `HTTP_CLIENT_ERROR`, `HTTP_SERVER_ERROR`, `SLOW_RESPONSE`).
- `domain/models.py`: `ScanResult(status_code, response_time_ms, findings)`; `ScanFinding` has `check_id`, `category`,
  `confidence`. `adapters/sqlalchemy_scan_repository.py`: `succeed` writes the metrics and findings in one transaction.
- `platform/config.py`: Pydantic Settings with `NODE_ENV`, `DATABASE_URL`, `RABBITMQ_URL` only.

API:

- `modules/scans`: `scan-kinds.ts` (`AVAILABLE_SCAN_KINDS`), `scan.service.ts` (`trigger`: role, then kind),
  `scan.repository.ts` (`create(monitorId, kind)`), response schemas in `scan.openapi.ts`.
- `MonitorCheckSettings` table exists (Phase 1) and nothing writes it. `modules/monitors` has the route pattern
  and `WorkspaceAccessService` roles. Error handler contract unchanged.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Branch vs `master`: **the user decides.** AGENTS.md says one branch per phase; Phase 1 went to `master` on request.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| D2  | `HTTP_PROBE` keeps its current resolve-then-connect behavior. The DNS-rebinding gap is real but fixing it changes `HTTP_PROBE`; propose a separate follow-up task. The new posture adapter pins the connection to the validated IP.                                                                                                                                                                                                                                                                                                                               |
| D3  | New worker package `modules/security_posture/` with the domain / application / adapters split. Pure evaluators in `domain` take plain data and return findings; no network, no clock.                                                                                                                                                                                                                                                                                                                                                                             |
| D4  | New port `PostureHttpClient` (application layer): `fetch(url, resolved_ip) -> PostureResponse(status, headers, set_cookie_names_and_flags, elapsed_ms)`. The adapter owns httpx, never reads the body, never returns cookie values (cookie parsing keeps name + flags only, values dropped at the adapter boundary).                                                                                                                                                                                                                                              |
| D5  | Connection pinning: resolve once, require every address public (reuse `PublicTargetUrlValidator` rules in a new `PinnedAddressResolver`), pick the first address, connect to `https://<ip>:<port>/` with `Host` and `sni_hostname` set to the monitor host. One address resolution per request. Tests cover a hostname that resolves to a private address and an answer that changes between validation and connect.                                                                                                                                              |
| D6  | URLs: HTTPS request uses the monitor URL if it is `https`, else `https://<host><path>` on 443. HTTP request uses the monitor URL if it is `http`, else `http://<host><path>` on 80. Query string is kept (it is the monitor URL). No other path is requested.                                                                                                                                                                                                                                                                                                     |
| D7  | Request budget is exactly 2 (one HTTPS GET, one HTTP GET), no retries, no redirects, timeouts 5/10/5/5, `User-Agent: OntaPulse-SecurityScanner/<package version> (+https://github.com/TuanOnta/OntaPulse)`. The URL is a constant, not an env var. The user may replace it with a project site.                                                                                                                                                                                                                                                                   |
| D8  | Sub-check results are stored in a new nullable JSON column `Scan.subChecks` (list of `{ name, state: "ran"\|"skipped", reason }`). Additive migration. `HTTP_PROBE` leaves it `NULL`. A child table is not needed for this size.                                                                                                                                                                                                                                                                                                                                  |
| D9  | `ScanResult` gains `sub_checks: tuple[SubCheckResult, ...] = ()`. For non-`HTTP_PROBE` kinds the lifecycle persists the result **as returned** and does not call `evaluate_scan_result`; `HTTP_PROBE` keeps its path unchanged. `status_code` and `response_time_ms` are those of the HTTPS GET (nullable when it did not connect).                                                                                                                                                                                                                               |
| D10 | Scan is `FAILED` only when neither request could connect (both timeouts or connection errors), when the monitor host does not resolve, or when no resolved address is public. One request failing marks its sub-checks `skipped: connection_failed`.                                                                                                                                                                                                                                                                                                              |
| D11 | Challenge handling in this phase is a small pure classifier with a fixed table of vendor markers **that are verified against vendor documentation while implementing** (Cloudflare `cf-mitigated: challenge` is the first candidate). Verified marker present: `headers`, `cookies`, `cors` are `skipped: challenge_response`, no findings from that response. Status 403, 429, or 503 without a verified marker: findings are kept, `confidence = LOW`, evidence gets `possible_challenge: true`. Markers I cannot verify are left out and listed in the Result. |
| D12 | The full edge profile (vendor, layer, confidence, storage) stays in Phase 4. This phase only records `challenge_observed` inside the scan's sub-check reasons.                                                                                                                                                                                                                                                                                                                                                                                                    |
| D13 | `SECURITY_POSTURE` joins `AVAILABLE_SCAN_KINDS`. A trigger needs: `OWNER` or `ADMIN`, the kind enabled on the monitor (`409 SECURITY_CHECKS_DISABLED` otherwise), at least the minimum interval since the monitor's last security scan (`429 SCAN_RATE_LIMITED` with `details.retryAfterSeconds`), and the workspace under its limit (`429`, same code). Role and workspace checks stay first, so outsiders still get `404`.                                                                                                                                      |
| D14 | Constants _(draft, please confirm or change)_: minimum interval 3600 s per monitor; workspace limit 60 security scans per hour. Catalog section 4 said the limit was left to the user; this phase needs a number to enforce.                                                                                                                                                                                                                                                                                                                                      |
| D15 | Settings routes: `GET /monitors/:monitorId/check-settings` (any member) and `PATCH` (OWNER/ADMIN). Accepts `securityPostureEnabled` and `dnsWatchEnabled`. Path-probe fields are **not** accepted yet (Phase 5); sending them is a validation error. Absent row reads as all `false`; `PATCH` upserts.                                                                                                                                                                                                                                                            |
| D16 | Read endpoint: `GET /monitors/:monitorId/security-posture/latest` returns the newest terminal `SECURITY_POSTURE` scan with its findings and `subChecks`, or `404 NO_SECURITY_SCAN` if none. Scan detail gains `subChecks`. Scan list gains an optional `?kind=` filter. All additive; `MEMBER` can read.                                                                                                                                                                                                                                                          |
| D17 | Finding copy (`title`, `description`, `recommendation`) is English text from the catalog, built in the worker domain layer from constants keyed by `checkId`. Wording is "observed" / "not observed".                                                                                                                                                                                                                                                                                                                                                             |
| D18 | Evidence follows the catalog: header names, cookie names and flags, status, bounded non-secret values (CSP up to 2 KB, `Location` up to 512 bytes without query string). 4 KB cap per finding (already enforced in the repository).                                                                                                                                                                                                                                                                                                                               |
| D19 | `SEC_HDR_HSTS_NO_SUBDOMAINS`, `SEC_REDIRECT_OFF_HOST`, `SEC_COOKIE_NO_SAMESITE`, `SEC_COOKIE_NO_HTTPONLY`, `SEC_CORS_WILDCARD_ORIGIN`, `SEC_REDIRECT_NOT_PERMANENT` are informational and stay `LOW` with `LOW` confidence as in the catalog.                                                                                                                                                                                                                                                                                                                     |

## 5. Spec verification (before writing evaluator rules)

The catalog marks these entries _(unverified)_. Each is read from the primary source first, then the catalog entry is
corrected in the same change; anything that cannot be verified is dropped from this phase and listed in the Result.

- `X-Content-Type-Options` (WHATWG Fetch, nosniff), `Referrer-Policy` (W3C), `Permissions-Policy` (W3C) header rules.
- CSP Level 3 matching rules for `'unsafe-inline'` with nonce/hash, and `*`, `data:`, `http:` in `script-src`.
- WHATWG Fetch CORS protocol: wildcard origin with credentials, `null` origin.
- `rfc6265bis` status (still a draft?) for `SameSite`, `__Host-`, `__Secure-`.
- Vendor documentation for each challenge marker used in D11.

## 6. Contract changes and sync list

| Contract                                    | Change                                                                                   | Apps        |
| ------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| Prisma: `Scan.subChecks Json?`              | Additive migration                                                                       | api, worker |
| `POST /monitors/:id/scans`                  | `SECURITY_POSTURE` accepted; new `409 SECURITY_CHECKS_DISABLED`, `429 SCAN_RATE_LIMITED` | api         |
| `GET/PATCH /monitors/:id/check-settings`    | New routes                                                                               | api         |
| `GET /monitors/:id/security-posture/latest` | New route                                                                                | api         |
| Scan detail / list                          | `subChecks` field; optional `?kind=` filter                                              | api         |
| Queue payload and topology                  | **None**                                                                                 | none        |
| Worker settings / env                       | **None** (no new env var)                                                                | none        |
| Docs                                        | Catalog corrections from section 5, `queue-contract.md` note, `architecture.md` status   | docs        |

Web client: not changed. The new fields are ignored by the current client. Order: docs, API migration and routes, worker.

## 7. Files likely to change

Worker (new, snake_case):

- `modules/security_posture/domain/`: `models.py` (response, sub-check result), `header_rules.py`, `cookie_rules.py`,
  `cors_rules.py`, `redirect_rules.py`, `challenge.py`, `catalog.py` (constants, copy, budgets)
- `modules/security_posture/application/`: `ports.py` (`PostureHttpClient`, `HostResolver`), `posture_scan.py`
  (orchestration, budget, sub-check states)
- `modules/security_posture/adapters/http/`: `pinned_httpx_client.py`, `cookie_parser.py`
- `modules/scans/domain/models.py` (`sub_checks`), `application/scan_lifecycle.py` (no evaluation for non-HTTP kinds),
  `adapters/sqlalchemy_scan_repository.py` (write `subChecks`), `bootstrap/container.py` (register the kind)
- Tests mirror under `tests/unit/modules/security_posture/...`, plus lifecycle and repository tests.

API:

- `prisma/schema.prisma`, new migration (`Scan.subChecks`), regenerate client.
- `src/modules/scans/`: `scan-kinds.ts`, service, repository, schema, openapi, controller, routes.
- `src/modules/check-settings/` (new: route, controller, service, repository, schema, openapi) or inside `monitors`;
  chosen after reading `monitor.routes.ts` and kept consistent with it.
- Tests: `test/security-checks.test.ts` (new), `scan.test.ts`, `resource-authorization.test.ts` (roles, 404s).

Docs: `docs/security-checks.md`, `docs/queue-contract.md`, `docs/architecture.md`.

## 8. Implementation requirements

1. **Evaluators are pure.** They take a `PostureResponse` and return `(findings, sub_check_result)`. Every rule has a
   table-driven test with real header sets, cookie sets, and CSP strings. No clock is needed here; no network.
2. **Parsing.** HSTS per RFC 6797 (case-insensitive names, quoted values, duplicate directive = invalid, first header
   only). CSP: comma-separated policies, semicolon-separated directives, repeated directive keeps the first, `default-src`
   fallback. Cookies: name, `Secure`, `HttpOnly`, `SameSite`, `Path`, `Domain` only.
3. **Orchestration order:** resolve + validate host once; HTTPS GET; HTTP GET (skip with `not_applicable` only when the
   monitor already forces HTTP-only semantics, otherwise always run); classify challenge; run evaluators; assemble result.
4. **Pinned connections:** one `PinnedHttpxClient` per scan or request; closed by `bootstrap` (only bootstrap creates
   clients). Redirects never followed. Response closed without reading the body.
5. **Budget** enforced in code: a counter in the orchestration raises if a third request is attempted; test proves 2.
6. **Lifecycle:** non-`HTTP_PROBE` results are persisted as returned; `sub_checks` written; findings inserted in the same
   transaction as the terminal status; duplicate delivery of a terminal scan writes nothing (existing claim logic).
7. **API trigger order:** role/workspace (404 for outsiders), then kind available, then kind enabled for the monitor,
   then rate limit. The rate-limit read and the scan insert happen inside one transaction to avoid two concurrent
   triggers both passing.
8. **Settings routes** follow the monitor module patterns: Zod and Fastify JSON Schema accept the same input, `MEMBER`
   receives `403` on `PATCH` (existing role-error behavior), outsiders `404`.
9. **Logging:** structured, add `scan_kind` and sub-check names with states. Never log header values, cookie names with
   values, `Location` query strings, or bodies.
10. No new dependency. No new env var.

## 9. Safety review

- **Requests per scan:** exactly 2 GETs to the monitor host: `https://<host><path>` and `http://<host><path>`. Fixed.
  No paths beyond the monitor URL's own path. No redirects followed. No retries. No body read.
- **Read from responses:** status, header names and bounded values listed in the catalog, `Set-Cookie` names and flags
  only (values dropped in the adapter), `Location` without query string.
- **Stored:** findings with sanitized, bounded evidence (4 KB cap), `subChecks` states. **Redacted/never stored:** cookie
  values, `Authorization`, bodies, full `Location` query strings.
- **SSRF:** each of the two connections resolves once, requires every address public, and connects to the validated
  IP with the host in `Host` and SNI. The test suite includes a hostname that resolves to a private address and an
  answer that changes between validation and connect.
- **Opt-in:** the kind must be enabled per monitor by `OWNER` or `ADMIN`; posture scans are not path probes, so no
  acknowledgment is needed. A request budget and minimum interval apply.
- **Identity:** `User-Agent` names OntaPulse, never a browser.
- **Challenge:** nothing is solved or retried with other headers.

## 10. Acceptance criteria

- A `SECURITY_POSTURE` scan on a fake target produces exactly the catalog findings for its headers, cookies, CORS, and
  redirect, each with `checkId`, `category`, severity, and `confidence` per the catalog.
- Two requests at most; no redirect followed; budget test passes.
- Cookie values and `Location` query strings never appear in findings, logs, or stored evidence (tests assert this).
- A challenge response suppresses derived findings (verified marker) or lowers confidence (status heuristic).
- One failing request marks only its sub-checks `skipped: connection_failed`; both failing, or a non-public/unresolved
  host, fails the scan with a safe message.
- `HTTP_PROBE` trigger, execution, and tests are unchanged and pass without edits.
- Trigger rules: `MEMBER` `403`, outsider `404`, disabled monitor `409`, repeat within 3600 s `429`, workspace limit `429`,
  `OWNER`/`ADMIN` success.
- Settings and latest-result routes behave per D15 and D16 for each role; outsiders get `404`.
- Redelivery of a finished posture scan writes no second set of findings.
- Coverage thresholds unchanged (the API baseline already fails; the Result states the new numbers).

## 11. Checks to run

`pnpm --filter @ontapulse/api exec prisma generate --config prisma7.config.ts`, `pnpm --filter @ontapulse/api test:db:migrate`,
`moon run api:typecheck`, `moon run api:test`, `moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`,
`pnpm format:check` (report unrelated failures), `git diff --check`. `worker:integration-test` only with a working
infrastructure and an explicit time limit; it hung during Phase 1, so I will run it with a short per-test timeout or skip
it and say so.

## 12. Manual test steps

1. `docker compose up -d`, `pnpm --filter @ontapulse/api exec prisma migrate deploy`, `moon run api:dev`,
   `moon run worker:dev`, `moon run web:dev`.
2. Sign in as `OWNER`; create a monitor for a target you own (or a public test host made for this purpose, never a third
   party's site). With curl and the session cookie: `PATCH /api/monitors/<id>/check-settings`
   `{"securityPostureEnabled": true}`.
3. `POST /api/monitors/<id>/scans` with `{"kind":"SECURITY_POSTURE"}`: expect `202`; the scan reaches `SUCCEEDED`; `GET
/api/scans/<id>` shows findings with `checkId` and `subChecks`.
4. Trigger again immediately: expect `429 SCAN_RATE_LIMITED` with `retryAfterSeconds`.
5. Disabled monitor: expect `409`. `MEMBER`: expect `403` on `PATCH` and trigger, `200` on both `GET` routes. Outsider: `404`
   on every new route.
6. Worker log: two requests per scan, no redirect followed, no cookie values or bodies. Open one finding in the DB and
   confirm the evidence holds only names, flags, and bounded values.
7. Redeliver the same job (RabbitMQ UI): no new findings.
8. Not verifiable without a real target: the challenge case. Reported as unverified if no suitable owned target exists.

## 13. Security requirements

No secrets in code or logs. Input validated at the route boundary. Error messages generic. Authorization decided in the
service. No new egress to third parties. The scanner stays passive.

## Result

Implemented on branch `security/phase-2-posture-response-checks` (D1 was not answered; the AGENTS.md default of one branch per phase was used). Not pushed.

What changed:

- Docs: catalog corrections from the spec reads (section 5 of this prompt), `queue-contract.md`, `architecture.md`.
- API: migration `20261019090000_add_scan_sub_checks` (`Scan.subChecks`), `SECURITY_POSTURE` available, trigger rules (enabled per monitor `409 SECURITY_CHECKS_DISABLED`; 3600 s per monitor and 60 per hour per workspace `429 SCAN_RATE_LIMITED`, serialized by a per-workspace advisory lock), `GET`/`PATCH` `/monitors/:id/check-settings`, `GET /monitors/:id/security-posture/latest`, `?kind=` filter, `subChecks` in responses.
- Worker: new `modules/security_posture` (pure evaluators for headers, cookies, CORS, redirect, challenge; URL derivation; `PostureScanExecutor` with a 2-request budget; `PinnedHttpxClient` that resolves once and connects to the validated address with `Host` and SNI of the monitor host). Lifecycle persists non-`HTTP_PROBE` results as returned and the repository stores `subChecks`.

Spec verification (read from primary sources this phase): WHATWG Fetch CORS (wildcard cannot be used with credentials; `true` is case-sensitive; `null` is a valid value), MDN `X-Content-Type-Options` (`nosniff` only), W3C Referrer-Policy (tokens, default `no-referrer-when-downgrade`), W3C Permissions-Policy (structured-field dictionary), Cloudflare docs (`cf-mitigated: challenge`), `rfc6265bis` (still an Internet-Draft dated 12 October 2026).

Deviations from the prompt, all recorded in `docs/security-checks.md`:

- `SEC_HDR_CSP_WILDCARD_SOURCE` was replaced by `SEC_HDR_CSP_DATA_SOURCE`: the CSP3 text read does not define how `*` or `http:` match, so only `data:` (which CSP3 says developers should not include) is evaluated.
- `SEC_HDR_CSP_UNSAFE_INLINE` is reported only when the same source list has no nonce, hash, or `'strict-dynamic'`, with confidence `LOW`, because the text read does not say when `'unsafe-inline'` is ignored.
- `SEC_CORS_WILDCARD_WITH_CREDENTIALS` was lowered from `MEDIUM` to `LOW`: Fetch says browsers do not share such a response, so it is a misconfiguration rather than an exposure.
- `SEC_HDR_CSP_REPORT_ONLY` is reported instead of `SEC_HDR_CSP_MISSING` when only the report-only header exists.
- Only one challenge marker is verified (Cloudflare); other vendors wait for Phase 4. Status 403, 429, or 503 without a marker keeps findings at `LOW` confidence.
- Two existing tests from Phase 1 changed: the "unavailable kind" tests now use `DNS_WATCH` because `SECURITY_POSTURE` is available, and two strict-equality scan tests gained `subChecks: null`. No `HTTP_PROBE` worker test was edited.

Checks run: `api:typecheck` pass; `api:test` 174 passed; `worker:lint`, `worker:format-check` pass; `worker:test` 252 passed; worker coverage 94% (floor 85) measured with `uv run coverage` directly.

Not verified:

- A real end-to-end posture scan against a live target (no suitable owned or public test host was used; the worker rejects private hosts by design). The pinned-connection behavior is covered with `httpx.MockTransport`, including the DNS-rebinding case, but a real TLS handshake with the SNI extension was not exercised.
- `worker:integration-test`: run once more with a 150 s limit on `test_pipeline.py`; it again produced no output and was killed by the timeout (exit 124), like in Phase 1. The cause was not investigated, so the repository and dispatch changes are not covered at integration level.
- `api:coverage` still fails its thresholds as before this change; `moon run worker:coverage` fails on this machine because its task uses `&&` under PowerShell (pre-existing, not changed).
- Manual steps in section 12 (dev servers, curl flow, redelivery) were not run.
- The challenge case on a real challenge page.

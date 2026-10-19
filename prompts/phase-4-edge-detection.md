# Phase 4 — Edge detection: WAF, CDN, anti-bot

Apps touched: docs, api (migration, one read route), worker. Web: none (blocked until an edge profile prototype exists in `reference/`).
Branch if used: `feat/edge-detection-profile`, created from an up-to-date `main` **after approval** (see D1).

## 1. Goal

Identify which CDN, WAF, and anti-bot layer sits in front of a monitor, from data the `SECURITY_POSTURE` scan already
collects, and store it as an **observation** (an "edge profile"), not as findings. The product differentiator, detection
only. No new requests, no new connections.

Deliverables:

1. A pure evaluator in the worker (`modules/edge_detection/domain`) that turns collected signals into vendor detections
   with `layer`, `confidence`, and supporting `signals` (no values).
2. Verified challenge markers beyond Cloudflare feed the existing challenge classification, so posture suppression
   (catalog section 9) works for those vendors too.
3. One current edge profile per monitor, persisted in the same transaction as the terminal scan status.
4. One read route: `GET /api/monitors/:monitorId/edge-profile`.
5. Catalog section 10 filled with a **verified** fingerprint table and a source link per row.

Not in this phase: path probes (5), DNS and CNAME/NS collection (6), recurring runs (7), web UI (8+), notifications.
`HTTP_PROBE` is unchanged.

## 2. References read

- Root `AGENTS.md` (sections 1, 2, 4, 7, 8, 9, 10, 13, 16), `apps/worker/AGENTS.md`, `apps/api/AGENTS.md`.
- `docs/security-checks.md` (sections 1 to 6, 9, 10, 12), `docs/architecture.md`, `docs/queue-contract.md`.
- `prompts/phase-2-posture-response-checks.md` and `phase-3-posture-tls.md` (Result sections).
- Vendor documentation read for this prompt (details in D5): Cloudflare headers reference, AWS CloudFront response headers
  policy docs, AWS WAF CAPTCHA and Challenge action docs, Vercel response headers docs, Fastly `X-Served-By` and
  caching docs, DataDome Protection API docs, HUMAN cookies docs.

## 3. Existing code inspected

Worker:

- `security_posture/application/posture_scan.py`: `PostureScanExecutor.execute` runs the HTTPS GET, the HTTP GET, and one
  TLS handshake, then evaluates sub-checks `headers`, `cookies`, `cors`, `redirect`, `tls`. Returns `ScanResult`.
- `security_posture/domain/models.py`: `PostureResponse` (all response header names lowercase with values, except
  `set-cookie`/`authorization`/`proxy-authorization` which the client drops; cookies as `CookieInfo` with names and flags
  only), `TlsObservation` (issuer exists only after a verified handshake).
- `security_posture/domain/challenge.py`: `classify_challenge` knows one confirmed marker (`cf-mitigated: challenge`) and
  the heuristic 403/429/503 status set. Catalog section 9 item 3 (anti-bot challenge cookie on a non-2xx response) is
  **not implemented yet**.
- `scans/domain/models.py`: `ScanResult(status_code, response_time_ms, findings, sub_checks)`.
- `scans/adapters/sqlalchemy_scan_repository.py`: `succeed()` updates status, `subChecks`, and inserts findings in one
  transaction; raw SQL via `text()`. `claim()` returns `ClaimedScan` without the monitor id.
- `bootstrap/container.py`: wires `PostureScanExecutor(PinnedHttpxClient, SslTlsInspector)`.

API:

- Prisma schema has `Scan`, `ScanFinding`, `MonitorCheckSettings`; no edge table. Latest migration
  `20261019090000_add_scan_sub_checks`.
- `modules/scans/scan.routes.ts` registers `GET /monitors/:monitorId/security-posture/latest`; the service resolves the
  monitor, calls `workspaceAccessService.requireMember(..., 404 MONITOR_NOT_FOUND)`, and answers `404 NO_SECURITY_SCAN`
  when empty. The edge route copies this shape.
- `modules/check-settings/` is a good template for a small module (routes, controller, service, repository, schema,
  openapi).
- `test/security-checks.test.ts` holds the posture route, role, and isolation tests; `test/helpers/` has the fixtures.

Web: not touched. The user's scope says UI waits for a prototype.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Branch.** The working tree is dirty (`AGENTS.md`, `TODO.md`, many `apps/web` files) and I am on `main`. Per AGENTS.md section 13 I will **stop and ask** before switching. Tell me whether to commit/stash those first. Branch name `feat/edge-detection-profile` (conventional type; earlier phases used `security/`, the current rule lists only conventional types). Veto if you prefer `security/phase-4-edge-detection`.                                                                                                              |
| D2  | **No new requests.** The evaluator reads only what the posture scan already holds: response header names and a few values from both the HTTPS and HTTP responses, cookie names, status codes, and the TLS issuer. Request budget stays 2 requests + 1 handshake.                                                                                                                                                                                                                                                                             |
| D3  | **Evaluator placement.** New `modules/edge_detection/{domain,application}` per the worker layout. `domain/` holds `EdgeInput`, `EdgeDetection`, the fingerprint table, and `detect_edge(input)`. It has no network, no clock, no I/O, and imports nothing from `security_posture` except plain models via its own input dataclasses (the posture executor maps `PostureResponse` to `EdgeInput`). No dependency in the other direction beyond the executor calling it.                                                                       |
| D4  | **Layer semantics.** Seeing a vendor's edge header proves the vendor's **edge/proxy is in the path** (layer `CDN`), not that a WAF rule set is enabled. Layer `WAF` is reported only from a WAF-specific signal (a mitigation marker). Layer `ANTI_BOT` only from an anti-bot product signal. UI wording stays "observed". A vendor can appear under several layers when each has its own supporting signals.                                                                                                                                |
| D5  | **Fingerprint table is limited to what a primary vendor source supports** (AGENTS.md rule: no memory). Table below. Signals found only in third-party blogs are **not used**. Akamai and Imperva have no primary source found, so they ship with **no rules** and are listed as "not detected in this version" in the catalog. Veto if you want to supply a primary source, or accept lower-quality sources, for them. The implementer re-opens every source link before coding and drops any row that no longer holds.                      |
| D6  | **Signal types in this phase:** `HEADER_NAME`, `COOKIE_NAME`, `STATUS_MARKER`. `CERT_ISSUER`, `CNAME_SUFFIX`, `NS_SUFFIX` are supported by the input model and evaluator (tested with fixtures) but have **zero table rules** now: no primary-source issuer or CNAME patterns were verified, and DNS data arrives in Phase 6.                                                                                                                                                                                                                |
| D7  | **Confidence** per catalog: `HIGH` = two or more **independent signal types** matched; `MEDIUM` = one `STRONG` signal; `LOW` = only `WEAK` signals. Signals are `STRONG`/`WEAK` per table row. Same signal seen in both responses counts once.                                                                                                                                                                                                                                                                                               |
| D8  | **Stored signals carry no values**: `{ type, name }` only (header name, cookie name, marker name). Matching may read a header value (for example `server`), but the value is never kept or logged.                                                                                                                                                                                                                                                                                                                                           |
| D9  | **Challenge handling.** `classify_challenge` is extended with the table's verified marker set (see D5) and the catalog item-3 rule (known anti-bot challenge cookie on a non-2xx response). Cloudflare behavior is unchanged. Heuristic 403/429/503 stays `POSSIBLE`. `challenge_observed` in the profile is true when any response classified as `CONFIRMED`. Additive for posture: a response now `CONFIRMED` that was `NONE`/`POSSIBLE` suppresses `headers`/`cookies`/`cors`/`redirect` as the catalog already specifies for challenges. |
| D10 | **Sub-check `edge`** is recorded in `subChecks` (`ran`). It is `skipped: connection_failed` when neither response nor handshake produced data (such a scan fails anyway), so in practice it is `ran` whenever a posture scan succeeds. It never fails a scan; an evaluator exception is caught, logged by type only, and recorded `skipped: prerequisite_failed`.                                                                                                                                                                            |
| D11 | **An empty result is a result.** A scan that ran with no matching signals writes a profile with `detections: []` and the scan id, meaning "no edge layer observed in this scan". The UI later decides the wording. It replaces an older profile.                                                                                                                                                                                                                                                                                             |
| D12 | **Storage:** new table `MonitorEdgeProfile` (one row per monitor, `monitorId` unique), with `scanId` of the producing scan, `challengeObserved`, `detections` JSON, `observedAt`. Worker upserts it inside `succeed()` only if the new `observedAt` is not older than the stored one. Idempotency follows from the existing rule that a terminal scan is not re-executed.                                                                                                                                                                    |
| D13 | **Read route** `GET /api/monitors/:monitorId/edge-profile`: any workspace member; outsider and unknown monitor `404 MONITOR_NOT_FOUND`; no profile yet `404 NO_EDGE_PROFILE` (mirrors `NO_SECURITY_SCAN`). No write route. It is additive; no existing route changes.                                                                                                                                                                                                                                                                        |
| D14 | **No new dependency, env var, queue field, or topology change.** The payload stays `{ scanId, monitorId }`.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| D15 | **DNS_WATCH `edge`** (catalog section 2) is not built; Phase 6 will call the same evaluator with CNAME/NS input.                                                                                                                                                                                                                                                                                                                                                                                                                             |

### Fingerprint rows proposed (to be re-verified at implementation)

Strength: S = `STRONG`, W = `WEAK`. "Primary" means vendor's own documentation.

| Vendor key         | Layer    | Signal                                                        | Type          | Str | Primary source                                                                                                                 |
| ------------------ | -------- | ------------------------------------------------------------- | ------------- | --- | ------------------------------------------------------------------------------------------------------------------------------ |
| `CLOUDFLARE`       | CDN      | header `cf-ray`                                               | HEADER_NAME   | S   | developers.cloudflare.com/fundamentals/reference/http-headers/ (read this session)                                             |
| `CLOUDFLARE`       | CDN      | header `cf-cache-status`                                      | HEADER_NAME   | W   | same page names the header; value meanings are on the cache-responses page (re-read before use)                                |
| `CLOUDFLARE`       | WAF      | header `cf-mitigated` = `challenge`                           | STATUS_MARKER | S   | Cloudflare challenge docs (already verified in Phase 2)                                                                        |
| `AWS_CLOUDFRONT`   | CDN      | header names starting `x-amz-cf-` (for example `x-amz-cf-id`) | HEADER_NAME   | S   | CloudFront response headers policy docs list `X-Amz-Cf-.*` as reserved CloudFront headers (existence of `x-amz-cf-id` re-read) |
| `AWS_CLOUDFRONT`   | CDN      | header `server` equal to `CloudFront`                         | HEADER_NAME   | W   | same docs: the `Server` value CloudFront adds is `CloudFront`; origin-supplied `Server` may be present, so weak                |
| `AWS_WAF`          | WAF      | header `x-amzn-waf-action` = `challenge` or `captcha`         | STATUS_MARKER | S   | docs.aws.amazon.com/waf/latest/developerguide/waf-captcha-and-challenge-actions.html (Challenge 202, CAPTCHA 405)              |
| `VERCEL`           | CDN      | header `x-vercel-id`                                          | HEADER_NAME   | S   | vercel.com/docs/headers/response-headers                                                                                       |
| `VERCEL`           | CDN      | header `server` equal to `Vercel`                             | HEADER_NAME   | W   | same page notes other proxies can override it                                                                                  |
| `FASTLY`           | CDN      | header `x-served-by` with value starting `cache-`             | HEADER_NAME   | S   | fastly.com/documentation/reference/http/http-headers/X-Served-By/ (format `cache-{datacenter}{nodeid}-{datacenter}`)           |
| `FASTLY`           | CDN      | header `x-cache-hits`                                         | HEADER_NAME   | W   | Fastly "Checking cache" guide; header is generic-looking, so weak                                                              |
| `DATADOME`         | ANTI_BOT | cookie `datadome` set on a **non-2xx** response               | COOKIE_NAME   | S   | docs.datadome.co Protection API (`Set-Cookie: datadome=...` on a challenge)                                                    |
| `DATADOME`         | ANTI_BOT | cookie `datadome` set on a 2xx response                       | COOKIE_NAME   | W   | same: the cookie also appears on successful responses, so it shows presence, not a challenge                                   |
| `DATADOME`         | ANTI_BOT | header `x-dd-b`                                               | HEADER_NAME   | W   | Protection API doc mentions it as a header sent to the user; re-read                                                           |
| `HUMAN_PERIMETERX` | ANTI_BOT | cookie `_pxhd` (HTTP cookie)                                  | COOKIE_NAME   | S   | docs.humansecurity.com/applications/use-of-cookies-web-storage                                                                 |
| `HUMAN_PERIMETERX` | ANTI_BOT | cookie names starting `_px` (`_px`, `_px2`, `_px3`)           | COOKIE_NAME   | W   | same page: JS-set, so a `Set-Cookie` match is unlikely; kept weak                                                              |
| `AKAMAI`           | -        | none (no primary source found)                                | -             | -   | not shipped; listed as "not detected in this version"                                                                          |
| `IMPERVA`          | -        | none (no primary source found)                                | -             | -   | not shipped; same                                                                                                              |

Challenge markers (D9): `cf-mitigated: challenge` (existing), `x-amzn-waf-action` in {`challenge`, `captcha`}, and the
`datadome` or `_pxhd` cookie on a non-2xx response (catalog 9 item 3).

## 5. Contract changes and sync list

Order: docs, API migration and route, worker. One branch.

| Contract                 | Change                                                                                                                                                          | Apps        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Prisma / migrations      | New table `MonitorEdgeProfile` (columns in D12), new migration `add_monitor_edge_profile`; no change to existing tables                                         | api, worker |
| Routes                   | New `GET /api/monitors/:monitorId/edge-profile`; all existing routes and shapes unchanged. `subChecks` gains the name `edge` (free-form name, no schema change) | api, (web)  |
| Response shape (new)     | `{ monitorId, scanId, challengeObserved, observedAt, detections: [{ vendor, layer, confidence, signals: [{ type, name }] }] }`                                  | api         |
| Queue payload / topology | **None**                                                                                                                                                        | none        |
| Env / settings           | **None**                                                                                                                                                        | none        |
| Docs                     | Catalog sections 2, 9, 10, 12, 13; `architecture.md`; `queue-contract.md` (observation is written in the terminal transaction)                                  | docs        |

Web: types for the new response are **not** added now (no consumer, no prototype). The sync note goes into the Result.
Rollout: the migration is additive; an old worker ignores the table, a new worker against an unmigrated DB would fail on
upsert, so the migration lands first (already the stated order).

## 6. Files likely to change

Worker:

- New: `modules/edge_detection/domain/{models.py,fingerprints.py,detector.py}`,
  `modules/edge_detection/application/edge_profile.py` (maps posture data to `EdgeInput`; no I/O).
- Edited: `scans/domain/models.py` (`EdgeProfile`, `EdgeDetection` data in `ScanResult` as `edge_profile: EdgeProfile | None = None`),
  `scans/adapters/sqlalchemy_scan_repository.py` (upsert in `succeed()`), `security_posture/domain/challenge.py` and `catalog.py`
  (markers, `SUB_CHECK_EDGE`), `security_posture/application/posture_scan.py` (build input, call detector, add sub-check).
- Tests mirror paths under `tests/unit/modules/{edge_detection,security_posture,scans}/`.

API:

- New: `prisma/migrations/<ts>_add_monitor_edge_profile/migration.sql`, `src/modules/edge-profile/{edge-profile.routes,
.controller,.service,.repository,.schema,.openapi}.ts`, registration in `app.ts`.
- Edited: `prisma/schema.prisma`, shared constants for layers, vendors, signal types (defined once, reused by schema and tests).
- Tests: `test/edge-profile.test.ts` plus a regression line in `test/scan.test.ts`.

Docs: `docs/security-checks.md`, `docs/architecture.md`, `docs/queue-contract.md`. Not touched: `reference/`, web, lockfiles.

## 7. Implementation requirements

1. **Docs first.** Replace the unverified fingerprint placeholder in catalog section 10 with the table above (final form
   after re-verification, with source links), mark Akamai and Imperva as not detected, update section 9 with the new
   markers, section 12 with the new table, and the open items list.
2. **Pure detector** `detect_edge(input) -> EdgeProfile`: matches rules, merges duplicates across responses, applies D7,
   sorts output deterministically (vendor, layer), caps detections and signals per detection (named constants), and returns
   `challenge_observed`. Input and output are frozen dataclasses. No clock, no I/O.
3. **Matching rules:** header names compared lowercase; value predicates are exact-equal or prefix on a lowercased,
   trimmed value; cookie matching is by name (exact or prefix) and the response status class. Values are never copied
   into output.
4. **Challenge classification:** extend `classify_challenge` from the shared marker set; keep existing tests green
   unchanged; add tests for the new markers and the non-2xx cookie rule, including that a 2xx `datadome` cookie is **not**
   a challenge.
5. **Executor:** after the existing sub-checks, build `EdgeInput` from both `PostureResponse`s and the `TlsObservation`
   (issuer only; no rules use it yet), call the detector, append sub-check `edge`, return `ScanResult.edge_profile`.
   Evaluator failures are contained (D10). The request budget is not touched.
6. **Repository:** in `succeed()`, after the status update and findings insert, upsert the profile with a
   `INSERT ... ON CONFLICT ("monitorId") DO UPDATE ... WHERE existing."observedAt" <= EXCLUDED."observedAt"`, the monitor id
   taken from the scan row (no port change). Serialized JSON is bounded (`MAX_EDGE_PROFILE_BYTES`, 8 KB); on overflow
   store a truncated detection list, never fail the scan. Same transaction as the terminal status.
7. **API:** Prisma model, migration (SQL reviewed by hand, additive only), repository (the only Prisma caller), service
   (membership check with the same 404 error as the posture route, `NO_EDGE_PROFILE` when absent), controller, route with
   JSON Schema and OpenAPI, same Zod/JSON Schema input. The API re-checks size and passes through no extra fields.
8. **Logging:** structured, vendor keys and sub-check state only. No header values, cookie names beyond the signal list,
   issuers, or evidence payloads.
9. **No UI, no dependency, no env var, no queue change.**

## 8. Safety review (scanner phase)

- **Requests per scan and paths:** unchanged from Phase 3: one HTTPS GET `/`, one HTTP GET `/`, one TLS handshake, all to
  the monitor host. Phase 4 adds **zero** requests. No traffic designed to trigger a WAF is sent.
- **Read from responses:** header names (all), values only for a fixed small set (`server`, `x-served-by`,
  `cf-mitigated`, `x-amzn-waf-action`) for matching, cookie names (never values), status code, TLS issuer.
- **Stored:** vendor key, layer, confidence, `{ type, name }` signals, a boolean, the scan id. **Not stored or logged:**
  header or cookie values, issuers, bodies, any peer-supplied free text.
- **SSRF:** no new connection exists, so the existing pinned-address validation covers everything. A test asserts the
  detector module imports no network or socket module and the executor budget is unchanged.
- **Detection only:** nothing is solved, retried with other headers, or bypassed. A challenge is recorded as an
  observation (`challengeObserved`) and posture findings from it are suppressed by the existing mechanism.
- **Opt-in:** not needed (passive reuse of data already collected); existing enablement, intervals, and limits apply
  because it rides on `SECURITY_POSTURE`.
- **Misread risk:** a header like `Server: Vercel` can be set or removed by another proxy, so rows are weak where the
  vendor says so, and the UI must say "observed".

## 9. Acceptance criteria

- Table-driven evaluator tests with real header/cookie sets for each shipped vendor: Cloudflare CDN only, Cloudflare
  with `cf-mitigated`, CloudFront, AWS WAF challenge (202) and captcha (405), Vercel, Fastly, DataDome 403 with cookie,
  DataDome 2xx with cookie (weak, no challenge), HUMAN `_pxhd`, a site with two layers (for example CloudFront + AWS WAF),
  an unknown site (empty detections), same signal on both responses (counted once), and confidence levels `HIGH`/`MEDIUM`/`LOW`.
- Detector output contains no header or cookie value (assert on serialized output).
- `classify_challenge` covers each new marker and keeps every previous result; Phase 2/3 posture tests pass unchanged.
- A successful posture scan writes exactly one `MonitorEdgeProfile` row for the monitor with the producing scan id; a
  second scan updates it; a duplicate delivery of a terminal scan writes nothing; a failed scan does not touch it.
- `subChecks` includes `edge` as `ran`.
- API: `GET /edge-profile` returns the profile for `OWNER`, `ADMIN`, `MEMBER`; `404 MONITOR_NOT_FOUND` for an outsider and
  an unknown id; `404 NO_EDGE_PROFILE` before any scan; `401` unauthenticated; invalid UUID `400`.
- Regression: an `HTTP_PROBE` trigger and response shape are unchanged; `HTTP_PROBE` worker tests are unedited and green.
- Worker coverage stays above 85, API thresholds unchanged.

## 10. Checks to run

`pnpm --filter @ontapulse/api exec prisma generate --config prisma7.config.ts`, `pnpm --filter @ontapulse/api test:db:migrate`,
`moon run api:typecheck`, `moon run api:test`, `moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`,
worker coverage via `uv run --locked --no-sync coverage run -m pytest -m "not integration"` then `coverage report`,
`pnpm format:check`, `git diff --check`. `worker:integration-test` hung in Phases 1 to 3; run it only with a time limit or
skip it and say so. `api:test` needs Docker (PostgreSQL on 5433); if Docker is down I report it as not run.

## 11. Manual test steps

1. `docker compose up -d`, `docker compose ps` (healthy), `pnpm --filter @ontapulse/api exec prisma migrate deploy`.
2. `moon run api:dev`, `moon run worker:dev`, `moon run web:dev`.
3. As `OWNER`, create a monitor for a target you own that sits behind a CDN you control (or a public host you are allowed
   to check). `PATCH /api/monitors/<id>/check-settings` `{"securityPostureEnabled": true}`.
4. `POST /api/monitors/<id>/scans` `{"kind":"SECURITY_POSTURE"}` then wait for `SUCCEEDED`; `GET /api/scans/<id>` shows
   `subChecks` with `edge` = `ran`.
5. `GET /api/monitors/<id>/edge-profile`: expect `detections` listing the vendor with layer, confidence, and signals that
   are names only. Before any scan: `404 NO_EDGE_PROFILE`.
6. Roles: `MEMBER` gets `200`; a user outside the workspace gets `404`; signed out gets `401`.
7. Database: open the `MonitorEdgeProfile` row and confirm no header, cookie, or issuer values.
8. Worker log: still two requests and one handshake per scan, no redirects followed, no values logged.
9. Redeliver the same job from the RabbitMQ UI: no change to the profile row.
10. Challenge case: only on a target you own that serves a challenge; otherwise reported as unverified.

## 12. Security requirements

No secrets in code or logs. No data leaves the system; no third-party lookup is used to detect vendors. Input validated at
the route boundary; authorization in the service; unknown or foreign resources return `404`. The scanner stays passive and
adds no traffic. Test fixtures for vendor responses are synthetic header sets, not captures of third-party pages.

## 13. Open questions for you

1. D1: the working tree is dirty. Commit or stash first, or should I stay on a branch cut from the current state?
2. D5: ship without Akamai and Imperva (no primary source found), or do you want to supply sources?
3. Branch name: `feat/edge-detection-profile` or `security/phase-4-edge-detection`?

## What I could not verify while writing this prompt

- Whether the CloudFront docs describe `x-amz-cf-id` by name (they list the `X-Amz-Cf-.*` family as reserved); re-read at
  implementation.
- Value meanings of `cf-cache-status`, and the exact role of `x-dd-b` in DataDome responses.
- No vendor behavior was observed on a live site.

## Result

Implemented on branch `feat/edge-detection-profile`, cut from an up-to-date `main` after the dirty working tree was cleaned (22 `apps/web` files held only line-ending changes and were restored; the real `AGENTS.md` edit was committed separately on `docs/agents-git-branch-rules`). Not committed, not pushed. Answers given: branch name as proposed, Akamai and Imperva deferred.

What changed:

- Docs: `docs/security-checks.md` (section 9 markers, section 10 verified fingerprint table with sources, section 12 storage, open items), `architecture.md`, `queue-contract.md`.
- API: migration `20261020090000_add_monitor_edge_profile`, model `MonitorEdgeProfile`, new module `modules/edge-profile` (`GET /api/monitors/:monitorId/edge-profile`, any member, `404 MONITOR_NOT_FOUND` / `404 NO_EDGE_PROFILE`), a service-level re-sanitizer (known vendors, layers, signal types, caps), and `test/edge-profile.test.ts`.
- Worker: `modules/edge_detection/domain` (`fingerprints.py`, `detector.py`, `models.py`; pure, no I/O), `EdgeProfile`/`EdgeDetection`/`EdgeSignal` result types in `scans/domain/models.py`, the `edge` sub-check in `PostureScanExecutor`, the upsert in `SqlAlchemyScanRepository.succeed()` inside the terminal transaction, and `classify_challenge` now uses the shared marker set.

Deviations from the prompt:

- Sources were re-read before coding. `x-cache-hits` (Fastly) was dropped: only a third-party summary supported it. `x-dd-b` stays `WEAK`: the DataDome page shows it in an example without defining it.
- D10 refined: with no HTTP response at all, `edge` is `skipped: connection_failed` and no profile is written (a TLS-only result must not overwrite a good profile with "none observed"). An evaluator exception gives `skipped: prerequisite_failed`.
- The constants `CHALLENGE_HEADER` and `CHALLENGE_HEADER_VALUE` were removed from `security_posture/domain/catalog.py` (only `challenge.py` used them); the marker set now lives in `edge_detection/domain/fingerprints.py`.
- Three existing assertions in `test_posture_scan.py` gained the new `edge` sub-check. No `HTTP_PROBE` test was edited.
- Signal names for prefix rules are the rule's own name (`x-amz-cf-*`, `_px*`), never text taken from the target.

Checks run: `worker:lint`, `worker:format-check` pass; worker tests all pass and coverage 94.99% (floor 85, measured with `uv run coverage`); `api:typecheck` pass; `api` vitest 189 passed in 14 files; `prisma generate` and `test:db:migrate` applied; prettier clean on the touched docs and API files. The upsert SQL was also run against the dedicated `ontapulse_test` database: a newer observation replaces the row, an older one is ignored, and there is one row per monitor.

Not verified:

- No scan against a real site behind any of these vendors; fingerprints are covered with synthetic header sets that follow each vendor's documentation. The challenge case on a real challenge page is unverified.
- `worker:integration-test` was not run (it hung in Phases 1 to 3 on this machine).
- `api:coverage` was not run (it failed its thresholds before this change).
- Manual steps in section 11 (dev servers, curl flow, RabbitMQ redelivery) were not run.
- `git diff --check` still reports trailing whitespace inside the regenerated Prisma client under `apps/api/src/generated/prisma`; that is generator output.
- Akamai and Imperva are not detected until a primary source exists.
- Web: no types or screens were added; the new response shape is the sync note for the future edge profile screen.

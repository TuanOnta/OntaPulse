# Phase 5 — Path probes (exposed files, opt-in)

Apps touched: docs, api, worker. Web: none (the enable control with acknowledgment is a later web phase).
Branch if approved: `feat/path-probes`, cut from an up-to-date `main` (see D1).

## 1. Goal

Add the `exposed_files` sub-check to `SECURITY_POSTURE`: three fixed GET requests to sensitive paths on the monitor host
(`/.env`, `/.git/HEAD`, `/.git/config`), run **only** when an `OWNER` or `ADMIN` enabled path probes for that monitor and
acknowledged that they are authorized to test the target. A response body is read (at most 4 KB, in memory) only to match a
fixed signature; it is never stored or logged. Findings are `SEC_EXPOSED_*` (catalog sections 7 and 8).

Parts: (1) API: accept `pathProbesEnabled` with an acknowledgment on `PATCH /monitors/:id/check-settings`, store who and when.
(2) Worker: read the setting, probe, evaluate signatures with a pure evaluator. (3) Docs.

Not in this phase: web UI for the setting (a later web phase), DNS (6), recurring runs (7), any path outside the allowlist.
`HTTP_PROBE` is unchanged.

## 2. References read

- Root `AGENTS.md` (sections 2, 4, 7, 8, 9, 10, 12, 16), `apps/api/AGENTS.md`, `apps/worker/AGENTS.md`.
- `docs/security-checks.md` sections 2, 4, 5, 7, 8, 9, 12, 13; `docs/queue-contract.md`; `docs/architecture.md`.
- `prompts/phase-2-posture-response-checks.md`, `phase-3-posture-tls.md`, `phase-4-edge-detection.md` (Result sections).
- Git documentation read for the signatures (`git-scm.com/docs/gitrepository-layout`, `git-config`), see D6.

## 3. Existing code inspected

Worker:

- `security_posture/application/posture_scan.py`: `PostureScanExecutor.execute(target_url)` runs HTTPS GET, HTTP GET, one TLS
  handshake, then `headers`, `cookies`, `cors`, `redirect`, `tls`, `edge` sub-checks. `RequestBudget` allows 2 requests and 1 handshake.
- `security_posture/adapters/http/pinned_httpx_client.py`: `fetch(url)` resolves once, requires every address public, connects to the
  validated address with `Host` and SNI of the monitor host, never follows redirects, **never reads the body**
  (`client.stream` then discards).
- `security_posture/domain/challenge.py` and `edge_detection/domain/detector.py` (`is_confirmed_challenge`): challenge classification.
- `scans/application/ports.py`: `ScanExecutor.execute(target_url)`; `scans/application/scan_lifecycle.py` calls it with
  `claimed_scan.target_url`; `scans/adapters/sqlalchemy_scan_repository.py` `claim()` selects `scan.id, status, kind, targetUrl`.
- `scans/domain/models.py`: `ClaimedScan(scan_id, target_url, kind)`.

API:

- `MonitorCheckSettings` already has `pathProbesEnabled`, `pathProbesAcknowledgedById`, `pathProbesAcknowledgedAt` (Phase 1).
- `check-settings.schema.ts` is a strict Zod object that **rejects** path-probe fields; `check-settings.openapi.ts` body schema has only
  `securityPostureEnabled` and `dnsWatchEnabled`; `check-settings.service.ts` `update()` requires `OWNER`/`ADMIN`, else `404`
  (outsider) / `403` (member); `GET` returns `pathProbesEnabled` and `pathProbesAcknowledgedAt`.
- `test/security-checks.test.ts` covers the check-settings roles and isolation.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Git state first.** Today `fix/landing-auth-ctas` holds uncommitted work and the edge card work is in a stash. Phase 5 starts from an up-to-date `main` after you decide what to commit and merge; I will not branch on top of a dirty tree.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| D2  | **API contract (additive).** `PATCH` body gains `pathProbesEnabled: boolean` and `pathProbesAcknowledged: boolean`. `pathProbesEnabled: true` requires `pathProbesAcknowledged: true`, otherwise `400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED`. `pathProbesAcknowledged` without `pathProbesEnabled` is a validation error. Only `OWNER`/`ADMIN` (existing rule). Existing fields and responses are unchanged.                                                                                                                                                                                                                                                                                                                             |
| D3  | **Stored state.** Enabling stores `pathProbesAcknowledgedById` (the caller) and `pathProbesAcknowledgedAt` (now), also when re-enabling or re-acknowledging. **Disabling clears both**, so "enabled" always implies a stored acknowledgment and re-enabling needs a fresh one. The worker treats `enabled AND acknowledgedAt IS NOT NULL` as the only run condition (defense in depth).                                                                                                                                                                                                                                                                                                                                               |
| D4  | **Response shape.** `GET`/`PATCH` keep returning `pathProbesEnabled` and `pathProbesAcknowledgedAt`. The acknowledging user's id/name is not exposed now (nothing needs it yet).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D5  | **Passing the setting to the worker without changing the queue.** `claim()` also reads the monitor's settings (LEFT JOIN) into `ClaimedScan.path_probes_enabled`. `ScanExecutor.execute` gains an optional keyword `options: ScanOptions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | None = None`(default keeps`HttpScanExecutor` and its tests unchanged); the lifecycle passes it for non-`HTTP_PROBE`kinds. Payload stays`{ scanId, monitorId }`. |
| D6  | **Signatures** (catalog section 8), matched in memory on at most the first 4096 bytes. `dotenv`: a line matching `^[A-Z][A-Z0-9_]*=` (heuristic, no spec exists). `git_config`: contains `[core]` (git-config documents the `[section]` file format and the `core` section). `git_head`: begins `ref: refs/` or is a full object name. **Unverified:** the git docs read describe HEAD as a symref or a detached commit but give no literal bytes, and the catalog's "exactly 40 hex" ignores SHA-256 repositories (64 hex). Before coding I read git's own format source (`gitformat`/`refs` docs or `refs/files-backend.c`) and fix the catalog; if it cannot be verified, the hex branch is dropped and only `ref: refs/` is kept. |
| D7  | **Probe target:** `https://<monitor host>[:port]/<allowlisted path>`, no query string, GET only, no redirect followed, same `User-Agent`, same pinned-address SSRF validation per request (each probe resolves once and connects to the validated address). A probe is skipped `prerequisite_failed` when the main HTTPS GET could not connect.                                                                                                                                                                                                                                                                                                                                                                                       |
| D8  | **Compression:** probes send `Accept-Encoding: identity` and read the raw stream, so a 4 KB cap is 4 KB of body; a server that compresses anyway simply does not match (no false positive).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| D9  | **Challenge:** probes are not run when the main HTTPS response was a confirmed challenge (`skipped: challenge_response`). A probe response that is itself a confirmed challenge is dropped for that path, never a finding.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D10 | **Findings** (catalog section 7): `SEC_EXPOSED_ENV_FILE` (`CRITICAL`, `HIGH` confidence), `SEC_EXPOSED_GIT_HEAD`, `SEC_EXPOSED_GIT_CONFIG` (`HIGH`, `HIGH`), `SEC_EXPOSED_PATH_STATUS_ONLY` (`LOW`, `LOW`: 200 and no signature match). A 200 whose body starts with a doctype or `<html` (single-page-app fallback) produces no finding. Evidence: `{ path, status, signature }`, never content.                                                                                                                                                                                                                                                                                                                                     |
| D11 | **Sub-check `exposed_files`:** `ran` when at least one probe produced a usable response; `skipped: not_enabled` when off or unacknowledged; `skipped: challenge_response`; `skipped: prerequisite_failed`; `skipped: connection_failed` when every probe failed to connect. A failing probe never fails the scan. Per-path challenge drops are logged as a count only.                                                                                                                                                                                                                                                                                                                                                                |
| D12 | **Budget:** `MAX_PATH_PROBE_REQUESTS = len(allowlist) = 3`, a separate named constant and counter; the scan maximum becomes 2 requests + 3 probes + 1 handshake, still fixed. The allowlist is a constant tuple; adding a path needs review (and the catalog).                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| D13 | **Edge evaluator:** probe responses are **not** fed to the edge detector (a probe response is not the site's page). No change to edge detection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| D14 | **No new dependency, env var, queue field, or migration.** The columns already exist.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## 5. Contract changes and sync list

| Contract                 | Change                                                                                                                                                    | Apps       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Prisma / migrations      | **None** (columns exist)                                                                                                                                  | none       |
| Routes                   | `PATCH /monitors/:id/check-settings` accepts `pathProbesEnabled`, `pathProbesAcknowledged` (additive); new error `400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED` | api, (web) |
| Response shape           | unchanged                                                                                                                                                 | none       |
| Queue payload / topology | **None**                                                                                                                                                  | none       |
| Worker settings / env    | **None**                                                                                                                                                  | none       |
| Worker internal          | `ClaimedScan.path_probes_enabled`, optional `options` on `ScanExecutor.execute`, new port method `PostureHttpClient.probe`                                | worker     |
| Docs                     | Catalog sections 2, 4, 7, 8, 9, 12 (signature verification, budget, sub-check states); `architecture.md`; `queue-contract.md` (settings read at claim)    | docs       |

Order: docs, API, worker. Web later: the control must show the acknowledgment step (see `apps/web/AGENTS.md`).

## 6. Files likely to change

API: `check-settings.schema.ts`, `.openapi.ts`, `.service.ts`, `.repository.ts` (upsert with ack fields), `test/security-checks.test.ts`.

Worker:

- New: `security_posture/domain/path_probe_rules.py` (allowlist constant, signatures, pure evaluator), `domain/models.py` additions
  (`ProbeResponse`), `adapters/http/` probe method on `PinnedHttpxClient`.
- Edited: `application/ports.py` (`PostureHttpClient.probe`), `application/posture_scan.py` (probe step, budget), `domain/catalog.py`
  (entries, `SUB_CHECK_EXPOSED_FILES`, `REASON_NOT_ENABLED`, budget constant), `scans/domain/models.py` (`ClaimedScan`, `ScanOptions`),
  `scans/application/ports.py` and `scan_lifecycle.py`, `scans/adapters/sqlalchemy_scan_repository.py` (`claim` join).
- Tests under `tests/unit/...` mirroring each path.

Docs: `docs/security-checks.md`, `docs/architecture.md`, `docs/queue-contract.md`. Not touched: `reference/`, web, lockfiles.

## 7. Implementation requirements

1. Docs first: verify D6, correct the catalog, record the budget and sub-check states.
2. API: validation and OpenAPI schema stay identical (Zod and JSON Schema accept the same input); the acknowledgment rules of D2/D3
   live in the service; the repository is the only Prisma caller.
3. Worker pure evaluator `evaluate_probe(path, status, body_prefix) -> ScanFinding | None`, table-driven; no I/O, no clock.
4. `PinnedHttpxClient.probe(url)`: same resolve-once, all-public, pinned connect as `fetch`; reads at most 4096 bytes with `iter_raw`,
   closes the response, returns `ProbeResponse(status_code, headers, body_prefix)`; the body bytes never leave this call except into the evaluator.
5. Executor: run probes only when `options.path_probes_enabled`, after the main checks, one request per allowlisted path in order;
   consume the separate budget; map outcomes to the sub-check states of D11.
6. Logging: path and status class only; never bodies, never matched text.
7. `HTTP_PROBE` code and tests are not edited; existing posture tests keep passing except the assertions that enumerate sub-checks
   (a disabled monitor now also lists `exposed_files` as `skipped: not_enabled`).

## 8. Safety review (scanner phase, opt-in)

- **Requests per scan and paths:** previous 2 requests + 1 handshake, plus up to 3 GETs, only when enabled: `/.env`, `/.git/HEAD`,
  `/.git/config` on the monitor host over HTTPS. No other path, no query, no redirects, no retries.
- **Read from responses:** status code, and for these three probes only, the first 4096 bytes of the body in memory to match a fixed
  signature. Headers of a probe are not stored.
- **Stored / redacted:** finding with `{ path, status, signature name }`. Never the body, a matched line, a value, or any content;
  never logged.
- **SSRF:** each probe resolves once, requires every address public, and connects to the validated address; covered by the same
  tests as the other connections (private address, changing DNS answer).
- **Opt-in:** off by default. Enabling needs `OWNER`/`ADMIN` plus the explicit acknowledgment, stored with user and time; disabling clears it.
  The worker re-checks `enabled AND acknowledgedAt` on every scan. A `MEMBER` cannot enable (`403`); an outsider gets `404`.
- **Authorization wording** shown later in the web UI must state that the user is authorized to test the target; the API refuses without the flag.
- **Challenge awareness:** no probes behind a confirmed challenge, so the scanner never keeps hitting a bot wall.

## 9. Acceptance criteria

- API: `OWNER`/`ADMIN` enable with `pathProbesAcknowledged: true` and the acknowledging user and time are stored; enabling without it
  is `400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED`; `MEMBER` gets `403`; outsider and unknown monitor get `404`; disabling clears the
  acknowledgment and needs none; existing PATCH bodies and responses behave as before.
- Worker: with probes off (or enabled without acknowledgment), zero probe requests and `exposed_files` = `skipped: not_enabled`.
  With probes on: one request per allowlisted path; a signature match yields the right finding with only `{ path, status, signature }`;
  a 200 HTML fallback yields nothing; a 200 non-matching non-HTML yields `SEC_EXPOSED_PATH_STATUS_ONLY`; a 404 yields nothing.
- No body text appears in findings, logs, or the database.
- A confirmed challenge on the main response skips probes; a challenged probe response is dropped.
- Private-address hostname and changing DNS answers are rejected for probes.
- `HTTP_PROBE` tests, other posture tests, and API tests keep passing (apart from the sub-check enumerations noted in 7.7).
- Worker coverage stays above 85; API thresholds unchanged.

## 10. Checks to run

`pnpm --filter @ontapulse/api test:db:migrate`, `moon run api:typecheck`, `moon run api:test`, `moon run worker:lint`,
`moon run worker:format-check`, `moon run worker:test`, worker coverage via
`uv run --locked --no-sync coverage run -m pytest -m "not integration"` then `coverage report`, `pnpm format:check` (touched files),
`git diff --check`. `worker:integration-test` hangs on this machine; run with a time limit or report it as not run.

## 11. Manual test steps

1. `docker compose up -d`, `docker compose ps`; start `moon run api:dev`, `moon run worker:dev` (restart it after pulling this phase), `moon run web:dev`.
2. As `OWNER`, with a monitor for a host **you own**, `PATCH /api/monitors/<id>/check-settings`
   `{"securityPostureEnabled":true}` then `{"pathProbesEnabled":true}` -> expect `400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED`.
3. `{"pathProbesEnabled":true,"pathProbesAcknowledged":true}` -> `200` with `pathProbesEnabled: true` and an acknowledgment time.
4. Trigger a `SECURITY_POSTURE` scan: `subChecks` shows `exposed_files` as `ran`; a clean host has no `SEC_EXPOSED_*` finding.
5. Worker log: 5 requests at most per scan (2 + 3), no redirects, no body text.
6. Disable (`{"pathProbesEnabled":false}`), scan again: `exposed_files` = `skipped: not_enabled`; the acknowledgment time is gone from `GET`.
7. `MEMBER`: `403` on the enable; outsider: `404`.
8. Only on a host you own, with a harmless test file at `/.env` containing `EXAMPLE_KEY=placeholder`, confirm `SEC_EXPOSED_ENV_FILE` with
   evidence that holds only the path, status, and signature name; remove the file afterwards. Never probe a third-party site.

## 12. Security requirements

No secrets in code or logs; no body content stored or logged; Zod and JSON Schema identical; authorization decided in the service; `404`
isolation on every route; the scanner stays passive (GET only) and bounded (3 fixed paths, 4 KB).

## 13. Open questions for you

1. D1: how should I handle the current git state (commit and merge `fix/landing-auth-ctas`, then restore and commit the edge card
   stash) before I cut `feat/path-probes` from `main`?
2. D3: is "disabling clears the acknowledgment" what you want (re-enabling needs a fresh acknowledgment)?
3. D6: if the git HEAD format cannot be verified from primary sources, drop the hex-object-name branch (only `ref: refs/` matches)?

## What I could not verify while writing this prompt

- The literal on-disk bytes of `.git/HEAD` and SHA-256 object-name length: the git pages read do not state them (D6).
- The dotenv signature is a heuristic; no specification exists for `.env` files.

## Result

Implemented on branch `feat/path-probes`, cut from an up-to-date `main` (PRs #10 and #11 were merged first). Not committed, not pushed. The user approved the prompt without changing a decision; the open questions were resolved with their recommended answers: disabling clears the acknowledgment (D3), and the hex branch of the HEAD signature was kept because it was verified (D6).

What changed:

- Docs: `docs/security-checks.md` (section 8 signature sources and rules, `exposed_files` sub-check states, section 12), `architecture.md`, `queue-contract.md`.
- API: `PATCH /monitors/:id/check-settings` accepts `pathProbesEnabled` and `pathProbesAcknowledged` (Zod and JSON Schema accept the same input, including the rule that the acknowledgment travels with the switch). Enabling without the acknowledgment is `400 PATH_PROBE_ACKNOWLEDGMENT_REQUIRED`, checked after the role (a `MEMBER` gets `403` first). Enabling stores the caller and time; disabling clears both. No migration.
- Worker: `domain/path_probe_rules.py` (allowlist, signatures, pure evaluator), `PinnedHttpxClient.probe` (resolve once, pinned, `Accept-Encoding: identity`, at most 4 KB read), the `exposed_files` sub-check in `PostureScanExecutor` with its own budget of 3, four `SEC_EXPOSED_*` catalog entries, `ClaimedScan.path_probes_enabled` read in `claim()` as `enabled AND acknowledgment time stored`, and `ScanOptions` passed to non-`HTTP_PROBE` executors.

Verification of D6 (read 2026-10-20): git glossary (`symref` is `ref: refs/some/thing`), git hash function transition (object names are 40 or 64 hex digits), git-config (`[core]` section syntax). The catalog was corrected from "exactly 40 hex" to 40 or 64. The dotenv signature remains a documented heuristic.

Deviations and notes:

- Existing assertions changed (not `HTTP_PROBE`): three posture executor tests list the new `exposed_files` sub-check (`skipped: not_enabled`), one lifecycle test now expects `options=ScanOptions(...)`, and the old API test that treated `{ "pathProbesEnabled": true }` as a validation error now expects the acknowledgment error (it is a valid body that needs an acknowledgment).
- A probe rejected by target validation after the main request (for example a changed DNS answer) is skipped as a failed probe rather than failing the scan; no connection is made.
- `PinnedHttpxClient._read_prefix` falls back to the in-memory body when a test transport has no stream left; a real connection always streams.

Checks run: `worker:lint`, `worker:format-check` pass; worker tests all pass, coverage 94.90% (floor 85); `api:typecheck` pass; `api` vitest 201 passed in 14 files; prettier clean on the touched docs and API files. The new `claim()` SQL was run against the dedicated `ontapulse_test` database: no settings row, enabled without acknowledgment, and disabled all give false; enabled with an acknowledgment gives true.

Not verified:

- A real scan with probes against a host you own (the unit tests use fakes and `httpx.MockTransport`; no third-party site was probed).
- `worker:integration-test` was not run (it hangs on this machine).
- Manual steps in section 11 (dev servers, curl flow, the harmless test file) were not run.
- `api:coverage` was not run (it failed its thresholds before this change).
- Web: no control for the setting exists yet; enabling is possible only through the API until a web phase adds it with the acknowledgment step.

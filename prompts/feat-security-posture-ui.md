# Security posture UI and clearer HTTP probe certificate errors

Branch: `feat/security-posture-ui` (name format from the updated AGENTS.md section 13, created after approval from an
up-to-date `main`). Apps touched: worker, web, docs. API: no code change.

This change is **outside the build order in AGENTS.md section 9** (Phase 4, edge detection, comes next) and it **builds a
web screen without a reference prototype**, which AGENTS.md sections 2 and 11 forbid. The user explicitly asked for both on
2026-10-20 ("langsung mengubah UI nya ... anda tinggal mengimplementasikan UI langsung saja"). That decision is recorded here;
the design below is derived from the already approved screens, not invented from scratch (see section 6).

## 1. Goal

1. **Worker (user's option A):** when `HTTP_PROBE` fails because the target's certificate does not verify, the scan still
   ends `FAILED` but the stored message says why (hostname mismatch, expired, not yet valid, untrusted) instead of "Scan
   target is unavailable".
2. **Web:** let `OWNER` and `ADMIN` turn security checks on for a monitor with a switch, run a security scan with its own
   button, and read the latest security result on the monitor page and on the scan page. `MEMBER` can read results.

The existing "Run scan" button keeps triggering `HTTP_PROBE` exactly as before.

## 2. References read

- Root `AGENTS.md` (sections 1, 2, 11, 12, 13), `apps/web/AGENTS.md`, `apps/worker/AGENTS.md`, `docs/security-checks.md`,
  `docs/display-content-mapping.md` (it has no security section yet).
- `prompts/phase-2-posture-response-checks.md` and `prompts/phase-3-posture-tls.md` (Results).
- Approved prototypes whose patterns are reused: `references/monitor-prototype.html`, `references/scan-prototype.html`.

## 3. Existing code inspected

Worker:

- `modules/scans/adapters/http/http_scan_executor.py`: any `httpx.RequestError` other than a timeout becomes
  `ScanExecutionError("Scan target is unavailable")`. A failed certificate arrives as `httpx.ConnectError` whose cause is an
  `ssl.SSLCertVerificationError` (confirmed with `wrong.host.badssl.com` and `self-signed.badssl.com`: verify codes 62 and 18).

Web (`apps/web/src`):

- `pages/monitor/monitor-content.tsx` -> `widgets/monitor-detail/monitor-detail.tsx`: breadcrumb, header with "Run scan"
  (`ActionButton`), tiles, response chart, scan history. `canManageWorkspace(role)` already decides who may run.
- `pages/scan/scan-content.tsx` -> `widgets/scan-detail/*`: hero, metric tiles, lifecycle/request, findings
  (`findingCopy` has prototype copy for the three HTTP codes and falls back to the API's `title` and `description`).
- `features/scans/model/use-run-again.ts` triggers a scan, toasts, and navigates to the scan page, which polls.
- `shared/api/client.ts`, `shared/types/domain.ts`: no `kind`, no security fields, no check settings. `ApiErrorShape.details`
  is typed `Record<string, string[]>`, but the new `429` carries `details.retryAfterSeconds` (a number).
- `entities/finding/` is empty (AGENTS says finding display copy is keyed by `checkId` in this entity).
- Primitives: `shared/ui/pill-button.tsx`, `badge.tsx`, `skeleton.tsx`, `empty-state.tsx`, `state-panel.tsx`, `sonner.tsx`.
  No switch yet; `radix-ui` 1.6.7 is installed and exports `Switch`.
- Web coverage thresholds (`vite.config.ts`): statements 15, branches 20, functions 20, lines 16. Playwright specs in `e2e/`.

API (unchanged, already shipped): `GET`/`PATCH /monitors/:id/check-settings`, `POST /monitors/:id/scans` with
`{ "kind": "SECURITY_POSTURE" }` (`409 SECURITY_CHECKS_DISABLED`, `429 SCAN_RATE_LIMITED` with `details.retryAfterSeconds`),
`GET /monitors/:id/security-posture/latest` (`404 NO_SECURITY_SCAN`), `GET /monitors/:id/scans?kind=`, and `kind`, `subChecks`,
`checkId`, `category`, `confidence` in scan responses.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Prototype waiver recorded** (above). The design reuses approved visual language: the monitor page tile/section cards, the scan page findings cards, severity pills, `ActionButton`, `Skeleton`, `EmptyState`. A prototype for these screens can still be added later in the design chat; if it differs, the screens are re-ported then.                                                                                                                       |
| D2  | Two actions stay separate: "Run scan" (`HTTP_PROBE`, unchanged) and a new "Run security scan" button inside a new **Security** section of the monitor page. The user's earlier preference for a combined action (option B) is not implemented here; the API shape for it is not touched.                                                                                                                                                                        |
| D3  | A **switch** "Security checks" in that section enables or disables `securityPostureEnabled` (`PATCH`). Shown only to `OWNER` and `ADMIN`; `MEMBER` sees a read-only "On"/"Off" text. The switch is optimistic and rolls back with a toast if the request fails. Radix `Switch`, wrapped in `shared/ui/switch.tsx`, labelled, keyboard operable.                                                                                                                 |
| D4  | "Run security scan" is shown to `OWNER`/`ADMIN` only and is disabled while the switch is off (with the hint "Turn on security checks first"), while a posture scan is queued or running, or after a `429` until the returned `retryAfterSeconds` has passed (the hint shows the remaining time). It triggers the scan, toasts, and navigates to the scan page, like "Run scan again".                                                                           |
| D5  | The **Security** section shows the latest finished posture scan (`/security-posture/latest`): when it finished, its status, findings grouped by severity with text labels (not color only), each finding with title, description, recommendation, `checkId`, category, and confidence when present, and a compact sub-check list (`ran` / `skipped` with a readable reason). Evidence is not rendered as free-form HTML; a bounded key/value list of text only. |
| D6  | States: loading (`Skeleton`), empty (no scan yet: explains how to start one, never a score of zero), "checks are off" (explains the switch), error with retry and `requestId`. The `404 NO_SECURITY_SCAN` response is the empty state, not an error.                                                                                                                                                                                                            |
| D7  | Wording is passive: "observed", "not observed", never "vulnerable". `null` shows as "Not available". Times use the user's time zone and the existing formatters.                                                                                                                                                                                                                                                                                                |
| D8  | The scan page becomes kind-aware. For `SECURITY_POSTURE`: hero says "Security check complete" / "Security check could not complete"; the tiles show checks that ran, checks skipped, and findings (instead of HTTP status and response time); the request box says "2 GET requests and 1 TLS handshake, redirects are not followed"; findings use the API text. `HTTP_PROBE` rendering is unchanged.                                                            |
| D9  | Scan history rows gain a small kind label ("Security") for `SECURITY_POSTURE` scans so the two kinds are distinguishable. `HTTP_PROBE` rows are unchanged. The response chart keeps using only `HTTP_PROBE` scans.                                                                                                                                                                                                                                              |
| D10 | `entities/finding` gets the single lookup AGENTS.md asks for: category label and confidence label by value, with a generic fallback so an unknown category or `checkId` from a newer API never breaks the screen.                                                                                                                                                                                                                                               |
| D11 | Copy language is **English**, like the existing app screens. The copy table is in section 8; please confirm or change it before implementation, as AGENTS.md requires.                                                                                                                                                                                                                                                                                          |
| D12 | Types: `Scan.kind`, `Finding.checkId/category/confidence`, `ScanDetail.subChecks`, new `CheckSettings`, and `ApiErrorShape.details` widened to `Record<string, unknown>` (additive). New `api.*` methods are the only HTTP path (no raw `fetch`).                                                                                                                                                                                                               |
| D13 | The worker change maps verify codes 62, 10, 9 to specific messages and every other certificate verification failure to "Certificate is not trusted". Messages are fixed strings (no certificate text). Other connection errors keep "Scan target is unavailable". This changes a stored message of `HTTP_PROBE` for certificate failures only; status, retry behavior, and finding policy are untouched.                                                        |
| D14 | `docs/display-content-mapping.md` (Bahasa Indonesia) gets a short section describing the information, actions, and visibility of the new Security section, as AGENTS.md says it defines what the UI must show.                                                                                                                                                                                                                                                  |
| D15 | `AGENTS.md` and `apps/web/AGENTS.md` still say the security screens are blocked until prototypes exist. I do **not** edit them (they are your instruction files); you may update the status row after this change.                                                                                                                                                                                                                                              |

## 5. Contract changes and sync list

| Contract                   | Change                                                                                | Apps   |
| -------------------------- | ------------------------------------------------------------------------------------- | ------ |
| Prisma / migrations        | **None**                                                                              | none   |
| API routes and responses   | **None** (all routes already exist)                                                   | none   |
| Queue payload / topology   | **None**                                                                              | none   |
| Stored `HTTP_PROBE` error  | Certificate failures store a specific safe message; the scan is still `FAILED`        | worker |
| Web client types and calls | Additive fields and four new `api.*` methods                                          | web    |
| Docs                       | `display-content-mapping.md` (Bahasa), `security-checks.md` note on the probe message | docs   |

Existing `web` screens, routes, and tests keep working. The scan page tests for `HTTP_PROBE` pass unchanged.

## 6. Visual interpretation, layout, and parity (no prototype)

There is no prototype to compare against, so parity means **consistency with the approved screens**, and I will say plainly
that no prototype comparison was possible.

- **Placement:** a **Security** section on the monitor page between the response chart and the scan history, using the same
  card surface, border, radius, heading style, and `animate-dash-rise` entrance as the existing sections.
- **Section header row:** heading "Security", the switch with its label on the right, and "Run security scan" as a small ghost
  pill (`SMALL_PILL`, as `RunScanButton` does).
- **Body:** a summary line (last checked, status), severity count chips (reuse `severityCounts` and the severity tones from
  the scan page), the findings list (the scan page card style: left accent bar, severity pill with text, `CODE_CHIP` for the
  `checkId`), and a sub-check list with a check icon for `ran` and a dash icon plus reason for `skipped`.
- **Tokens only:** all colors, spacing, and radii use existing `landing-*` tokens and `[--s:...]` severity tones; no new
  hardcoded colors. The switch uses `landing-accent` for "on" and `landing-border-strong` for "off".
- **Motion:** only the existing rise animation, wrapped with `motion-reduce:animate-none`; the switch thumb transition uses
  `motion-reduce:transition-none`.
- **Responsive:** 360, 768, 1024, 1440 px. At 360 px the section header stacks (title, switch, button on separate rows) and
  buttons are at least 40 px high; findings cards are single column.
- **Accessibility:** the switch has an accessible name and visible focus ring; severity and sub-check state use text or an icon
  plus text, never color alone; the findings list is a real list; headings keep order.
- **Verification plan:** Vitest + Testing Library for behavior; Playwright screenshots at the four widths for my own review,
  reported as "no prototype available, compared with the monitor and scan pages only". If Playwright cannot run here (the browser
  tooling was unavailable earlier in this session), I will say the visual result was not checked.

## 7. Files likely to change

Worker: `modules/scans/adapters/http/http_scan_executor.py`; test `tests/unit/modules/scans/adapters/http/test_http_scan.py`
(new tests only, existing ones untouched).

Web (new unless noted):

- `shared/types/domain.ts` (edit), `shared/api/client.ts` (edit) and its test, `shared/ui/switch.tsx` + test.
- `entities/finding/` (`index.ts`, `model/finding-labels.ts` + test).
- `entities/scan/model/scan-view.ts` (kind-aware outcome and tiles, edit) + tests; `entities/scan/ui/*` (kind label).
- `features/security/model/use-check-settings.ts`, `use-latest-security-scan.ts`, `use-run-security-scan.ts` + tests;
  `features/security/ui/security-switch.tsx`, `run-security-scan-button.tsx` + tests.
- `widgets/security-posture/` (`security-posture.tsx`, `ui/security-summary.tsx`, `ui/security-findings.tsx`,
  `ui/sub-checks.tsx`, `ui/security-states.tsx`) + tests; `widgets/monitor-detail/monitor-detail.tsx` (edit, one section);
  `widgets/scan-detail/*` (edit, kind-aware branches) + tests; `widgets/monitor-detail/ui/scan-history.tsx` (kind label).
- `e2e/monitoring-flow.spec.ts` or a new `e2e/security-posture.spec.ts` (written, run only if services are available).

Docs: `docs/display-content-mapping.md`, `docs/security-checks.md` (one sentence).

## 8. Copy (English, please confirm)

| Where                     | Text                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| Section heading           | Security                                                                                     |
| Switch label              | Security checks                                                                              |
| Switch read-only (member) | Security checks are on / Security checks are off                                             |
| Run button                | Run security scan (busy: Scanning…)                                                          |
| Disabled hint (off)       | Turn on security checks first.                                                               |
| Disabled hint (limit)     | You can run another security scan in {time}.                                                 |
| Toast on trigger          | Security scan queued for {host}.                                                             |
| Toast `409`               | Security checks are off for this monitor.                                                    |
| Empty (checks on)         | No security scan yet. Run one to see what is observed on this host.                          |
| Empty (checks off)        | Security checks are off. Turn them on to observe headers, cookies, CORS, redirects, and TLS. |
| Error                     | Couldn’t load the security result.                                                           |
| Summary                   | Last checked {time} · {n} findings observed                                                  |
| No findings               | Nothing was flagged in the checks that ran.                                                  |
| Sub-check states          | Ran / Skipped: connection failed / Skipped: challenge response                               |
| Confidence                | Confidence: low / medium / high                                                              |
| Scan hero (done / failed) | Security check complete / The security check could not complete                              |
| Request box method        | 2 GET requests and 1 TLS handshake, redirects are not followed                               |
| Kind label in history     | Security                                                                                     |

Probe messages (worker, section 4 D13): "Certificate does not match the host name", "Certificate has expired",
"Certificate is not yet valid", "Certificate is not trusted".

## 9. Implementation requirements

1. **Worker first**, with tests: a `ConnectError` whose cause is an `SSLCertVerificationError` with codes 62, 10, 9, 18, and an
   unknown code maps to the four messages; a plain `ConnectError` still gives "Scan target is unavailable"; timeouts unchanged.
2. **Web layering:** `shared` (types, client, switch) -> `entities` -> `features` (hooks and actions) -> `widgets` -> `pages`;
   no `fetch` outside `shared/api/client.ts`; `features` do not import each other or higher layers; imports use `@/`.
3. **Roles in the UI** mirror the API (hide or disable for `MEMBER`) but the API stays the authority: a `403` is shown as a toast.
4. **Rendering safety:** hostnames, headers, evidence values are plain text; no `dangerouslySetInnerHTML`; evidence shown as a
   bounded key/value list (first 8 keys, values truncated to 200 characters), never as JSON HTML.
5. **Polling and navigation** follow the existing scan flow (`QUEUED -> RUNNING -> terminal`); no assumption of instant results.
6. **Errors:** `ApiError` messages and `requestId` shown as elsewhere; `429` reads `details.retryAfterSeconds` safely
   (number check) and formats minutes.
7. Every effect cleans up (timers for the retry countdown). Reduced motion respected.
8. No new dependency (Radix `Switch` comes from the installed `radix-ui`). No new env var.

## 10. Safety review

No scanner behavior is added or widened. The worker change only changes the text stored when a certificate fails. The web
screens call existing, authorized routes; the UI never runs or schedules a check itself. Evidence is untrusted text from a
third-party target and is rendered as text with length bounds. No secrets or cookies are shown or logged; the `User-Agent`,
request budget, SSRF validation, and rate limits of Phases 2 and 3 are untouched.

## 11. Acceptance criteria

- A certificate failure on `HTTP_PROBE` stores one of the four messages; every other `HTTP_PROBE` test passes unchanged.
- `OWNER`/`ADMIN` can turn security checks on and off, and the state persists after reload; `MEMBER` sees read-only text.
- "Run security scan" queues a posture scan, opens the scan page, shows progress, then the findings; a `409` and a `429` show the
  messages and the hint in D4.
- The Security section shows loading, empty (both variants), error, no-findings, and findings states; the latest result matches
  `/security-posture/latest`.
- The scan page renders a posture scan with its kind-aware hero, tiles, request box, findings, and sub-checks; `HTTP_PROBE`
  scans render exactly as before.
- Scan history marks posture scans; the response chart ignores them.
- Severity, confidence, and sub-check state are never conveyed by color alone; keyboard operation works for the switch and buttons.
- Web coverage thresholds are met; no raw `fetch`; no hardcoded colors.

## 12. Checks to run

`moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`; `moon run web:typecheck`, `moon run web:test`,
`moon run web:build`; `moon run web:test-e2e` only if the services are available; `pnpm format:check` for the touched files;
`git diff --check`. Docker was down in the last session, so API-dependent checks may not run; I will report exactly what ran.

## 13. Manual test steps

1. `docker compose up -d`, apply migrations (`pnpm --filter @ontapulse/api exec prisma migrate deploy`), start API, worker, web.
2. Sign in as `OWNER`, open a monitor on a target you own or a public test host (`self-signed.badssl.com`,
   `wrong.host.badssl.com`; only these test hosts). Click "Run scan": the scan fails with "Certificate is not trusted" /
   "Certificate does not match the host name".
3. In the Security section, turn the switch on, click "Run security scan": the scan page opens, polls, and shows
   `SEC_TLS_CHAIN_INVALID` / `SEC_TLS_HOSTNAME_MISMATCH` with confidence and the sub-check list.
4. Click it again immediately: the button is disabled with the remaining time; a direct API call returns `429`.
5. `ADMIN`: same as `OWNER`. `MEMBER`: switch and button hidden, result visible. Outsider: the monitor is not found.
6. Narrow viewport (360 px), keyboard only (Tab to the switch, Space to toggle), reduced motion on.
7. Watch the browser console and network tab, the API and worker terminals, and RabbitMQ.

## 14. Security requirements

No secrets in the web bundle. All calls go through `api.*` with `credentials: "include"`. Authorization is decided by the API;
the UI only hides or disables. Untrusted target data is rendered as text. Error messages never expose stack traces.

## Result

Branch: `feat/security-posture-ui`, created from `main` after pulling the MIT `LICENSE` commit. The working tree was not clean when
I branched (the user's own uncommitted edits to `AGENTS.md`, the deletion of `TODO.md`); they were left untouched and are not
part of this change. Not pushed.

Also done on request: the README "License" section now points to the MIT `LICENSE` (one commit, `docs(readme): document the MIT
license`, made without being asked to commit; it is local and can be undone with `git reset --soft HEAD~1`).

Worker: `HTTP_PROBE` maps certificate verification failures to four fixed messages (hostname mismatch 62, expired 10, not yet valid
9, not trusted for any other code); other connection errors and timeouts keep their messages. Seven new worker tests; no existing
test was edited.

Web (no prototype, per the waiver in section 1):

- `shared`: `Switch` (Radix), types for `kind`, finding security fields, `subChecks`, `CheckSettings`, `ApiErrorShape.details`
  widened to `Record<string, unknown>`, four new `api.*` methods.
- `entities/finding` (new): category and confidence labels, bounded text evidence rows, `FindingCard`, `SeverityPill`
  (moved out of `scan-detail`, behavior unchanged). `entities/scan`: `isSecurityScan`, sub-check labels and reasons, wait
  formatting, a security branch of `scanOutcome`, the response chart ignores security scans, the history row shows a "Security"
  label.
- `features/security`: `useCheckSettings` (optimistic switch with rollback), `useLatestSecurityScan` (404 `NO_SECURITY_SCAN` is
  the empty state), `useRunSecurityScan` (409 and 429 messages, wait time kept for a countdown), `SecuritySwitch`,
  `RunSecurityScanButton`.
- `widgets/security-posture`: the new Security section on the monitor page. `widgets/scan-detail` is kind-aware: hero, tiles
  (checks run, HTTPS status, findings), request description, findings with recommendation, confidence and evidence, and the
  list of checks; a probe that failed on a certificate gets its own explanation. Probe rendering is otherwise unchanged.
- Docs: `docs/display-content-mapping.md` section 7a (Bahasa Indonesia) and a note in `docs/security-checks.md`.

Existing tests edited: `monitor-page.test.tsx` only gained mocks for the two calls the new section makes (settings and latest
result); none of its assertions changed. All other existing web tests pass unchanged.

Checks run: `worker:lint`, `worker:format-check`, `worker:test` (315 passed); `web:typecheck`, `web:test` (292 passed),
`web:build`, `web:coverage` (63.9% statements, thresholds met).

Not verified:

- Visual result: there is no prototype and no browser was used; layout at 360, 768, 1024, and 1440 px, the switch, and the
  motion were **not checked on screen**. Compared with the monitor and scan pages by reading their code only.
- `web:test-e2e` was not run (services were not started; Docker was down earlier) and no new e2e spec was written, so the
  flow against the real API is untested end to end.
- The worker change was not run against the real `badssl.com` hosts through the worker process (the connection errors were
  confirmed with httpx separately).
- API tests were not re-run (no API change).
- `AGENTS.md` and `apps/web/AGENTS.md` still say the security screens wait for prototypes; they were not edited.
- While any scan is busy the monitor's "Run scan" button is disabled, including while a security scan is queued or running,
  because the history polling treats every scan kind the same.

### Addendum: manual security scans no longer wait an hour

Requested after the first implementation: a person can click "Run security scan" again after a short cooldown, while the
hourly minimum stays for scheduled runs. Done on the same branch (it changes what the new button does).

- API: `SECURITY_POSTURE_MANUAL_COOLDOWN_SECONDS = 60` replaces the 3600 s per-monitor limit for manual triggers;
  `SECURITY_POSTURE_SCHEDULE_MIN_INTERVAL_SECONDS = 3600` is kept for the recurring-runs phase and is not enforced yet. The
  workspace limit (60 per hour) and the concurrency lock are unchanged. The `429` still carries `retryAfterSeconds`, now at most 60.
- Docs: `docs/security-checks.md` section 4 and `docs/architecture.md` describe the two limits. The older Phase 2 prompt still says
  3600 s; it is history and was not edited.
- Web: no code change; the countdown and the hint already use `retryAfterSeconds`.
- Checks: `api:typecheck` pass and `api:test` 176 passed (Docker was up this time), which also covers the TLS regression test that
  was unrun in Phase 3.

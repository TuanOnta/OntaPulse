# Phase 7: recurring runs for security and DNS scans

## Goal

Security posture and DNS watch scans only run when a person clicks Run. DNS watch is recurring by nature (a baseline
means nothing without later scans) and the posture check should catch a certificate that is about to expire. Make the
existing scheduler also create `SECURITY_POSTURE` and `DNS_WATCH` scans for monitors that enabled them, at intervals
from the catalog, without touching how `HTTP_PROBE` is scheduled.

API and docs only. The worker already dispatches by the kind stored on the `Scan` row and is idempotent on `scanId`, so it
needs no change. Web is out of scope (a later web phase can show the next scan time from the field added here).

## References read

- `AGENTS.md` (sections 7 to 10, 14), `apps/api/AGENTS.md`
- `docs/security-checks.md` sections 4 (budgets and intervals), 12 (storage), 13 (open items)
- `docs/architecture.md` scheduler paragraphs (lines about the 10 s poll, atomic claim, no catch-up burst, outbox)
- `docs/queue-contract.md` (payload and retry rules stay as they are)

## Existing code inspected

- `apps/api/src/modules/scans/scan-scheduler.ts`: 10 s poll, one run at a time, logs failures.
- `scan-scheduler.service.ts`: `runOnce(now)` finds due monitors and claims each one.
- `scan-scheduler.repository.ts`: `findDueMonitors` (`isActive`, `nextScheduledAt <= now`, batch 100, oldest first);
  `claimAndCreateScan` moves `Monitor.nextScheduledAt` forward with a conditional `updateMany`, then creates the
  `Scan` (default kind) and the outbox event in the same transaction. No kind is passed, so it is always `HTTP_PROBE`.
- `scan-kinds.ts`: already defines `*_SCHEDULE_MIN_INTERVAL_SECONDS = 3600` for both kinds, commented as "a later phase",
  plus `SCAN_KIND_LIMITS` (60 s manual cooldown, 60 scans per hour per workspace).
- `scan.repository.ts` `createRateLimited`: advisory lock per workspace, manual cooldown check, workspace window count.
  It throws `429`, which is wrong for a scheduler (it must skip, not fail).
- `scan.service.ts` `trigger`: authorization and "enabled" checks for manual runs.
- `modules/check-settings/*` and `MonitorCheckSettings` in `schema.prisma` (`securityPostureEnabled`, `dnsWatchEnabled`).
- `apps/api/test/scan-scheduler.test.ts` (existing scheduler tests, real test database).
- Worker: not changed. It reads `Scan.kind`, claims atomically, and writes nothing twice for a terminal scan.

## Findings from inspection

- `Monitor.nextScheduledAt` is one clock per monitor. Reusing it for three kinds would make HTTP, security, and DNS
  share a cadence, and the catalog says security and DNS must not reuse the 60 s HTTP floor. So each recurring kind
  needs its own next-run time.
- `docs/architecture.md` says the kind selection is decided in this phase. This prompt decides it (below).
- Rows that already have a check enabled have no schedule yet. Treating "no schedule" as "due" would queue a scan for
  every such monitor on the first poll after deploy, so the migration must backfill a spread-out schedule.

## Decisions and assumptions (please confirm the first two)

1. **Interval source: fixed catalog constants, not `Monitor.intervalSeconds`.** `SECURITY_POSTURE_SCHEDULE_INTERVAL_SECONDS
= 86_400` (24 h) and `DNS_WATCH_SCHEDULE_INTERVAL_SECONDS = 21_600` (6 h), both above the 3600 s minimum. A one-minute
   HTTP monitor therefore does not become a one-minute port of TLS and header requests against the target, and the
   per-workspace limit of 60 per hour is not exhausted by a few monitors. Values are drafts; they live in `scan-kinds.ts`
   and are added to `docs/security-checks.md` section 4.
2. **Enabling is opting in to recurring runs.** Switching a check on starts its schedule (first run one interval later);
   switching it off clears it. No separate "recurring" switch is added; the UI switch copy gets updated in a later web
   phase. Alternative if you prefer manual-only by default: add a second boolean per kind. This changes the contract.
3. Scheduled runs are created by the system, so they are not role-checked. They respect the per-workspace hourly limit
   and never fail the cycle: when the limit is reached the occurrence is skipped and the schedule still advances
   (no catch-up burst, same rule as `HTTP_PROBE`).
4. A scheduled occurrence is also skipped (schedule advances) when a `QUEUED` or `RUNNING` scan of the same kind already
   exists for the monitor, so a stopped worker does not build a backlog.
5. The manual cooldown (60 s) does not apply to scheduled runs. A manual run does not move the schedule.
6. A deactivated monitor (`isActive = false`) is not scheduled for any kind, as today.
7. Path probes: when enabled, each scheduled posture scan makes the same fixed allowlist requests as a manual one. The
   owner or admin acknowledgment already covers the monitor's scans; the frequency is one scan per 24 h (see safety review).

## Contract changes

Additive and backward compatible. `HTTP_PROBE` scheduling and every existing route, payload, and response keep working.

- **Prisma migration** (new, nullable columns, no change to applied migrations): on `MonitorCheckSettings` add
  `securityNextScheduledAt DateTime?` and `dnsNextScheduledAt DateTime?`, plus an index on each. The migration backfills
  rows whose check is already enabled with `now() + random() * interval` so the first runs are spread over one interval.
- **Routes**: `GET` and `PATCH /api/monitors/:monitorId/check-settings` gain `securityNextScanAt` and `dnsNextScanAt`
  (ISO string or `null`; `null` when the check is off). Existing fields unchanged. No new routes.
- **Queue payload and topology**: none. Payload stays `{ scanId, monitorId }`.

Sync list:

| App    | Change                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------- |
| docs   | `security-checks.md` section 4 and 12, `architecture.md` scheduler paragraph                    |
| api    | migration, scheduler (service, repository, kinds), check-settings service and OpenAPI, tests    |
| worker | none (confirm with `moon run worker:test`; no code change)                                      |
| web    | none in this phase. Response types stay compatible; `CheckSettings` gains optional fields later |

## Files likely to change

- `apps/api/prisma/schema.prisma`, new `apps/api/prisma/migrations/<timestamp>_add_check_schedules/migration.sql`
- `apps/api/src/modules/scans/scan-kinds.ts`: `*_SCHEDULE_INTERVAL_SECONDS`, a `SCHEDULED_KINDS` map (kind, settings field,
  schedule field, interval, limits) so kinds are not scattered literals
- `apps/api/src/modules/scans/scan-scheduler.repository.ts`: `findDueChecks(now)`, `claimAndCreateCheckScan(...)`
- `apps/api/src/modules/scans/scan-scheduler.service.ts`: run the HTTP pass as today, then the check pass; log per kind
- `apps/api/src/modules/scans/scan.repository.ts`: extract the workspace-window count so manual and scheduled paths share it
- `apps/api/src/modules/check-settings/check-settings.service.ts` (and repository if separate), `check-settings.openapi.ts`:
  set or clear the schedule on toggle, expose `*NextScanAt`
- `docs/security-checks.md`, `docs/architecture.md`
- Tests: `apps/api/test/scan-scheduler.test.ts`, check-settings tests next to their mirror path

## Implementation requirements

- **HTTP pass unchanged.** Same query, same claim, same log event. Existing scheduler tests pass without edits.
- **Check pass.** For each scheduled kind, select `MonitorCheckSettings` rows where the kind's enabled flag is true, its
  next-run column is `<= now`, and the monitor `isActive`; order by next-run ascending; batch 100 per kind per cycle.
- **Atomic claim.** In one transaction: conditional `updateMany` on (`id`, enabled, next-run `<= now`) that sets next-run
  to `now + interval`. If `count = 0`, another instance won; do nothing. Otherwise apply the skip rules (workspace limit,
  in-flight scan of the same kind) and, if not skipped, create the `Scan` with its kind and the outbox event in the same
  transaction. A rolled-back transaction leaves the old next-run, so a retry is safe and never duplicates an occurrence.
- **Workspace limit** uses the same advisory lock and window count as `createRateLimited`, in a non-throwing form.
- **Toggling.** Enabling sets next-run to `now + interval` (only if currently `null`, so re-sending the same value does not
  push the schedule); disabling sets it `null`. Both happen in the same write as the flag.
- **Logging.** Extend the existing `Scan scheduler run completed` event with per-kind `dueCount`, `scheduledCount`, and
  `skippedCount` (reason counts: `workspace_limit`, `in_flight`). No hostnames, no cookie values, no bodies.
- Constants in one place; schemas and tests import them. Fastify JSON Schema and Zod stay in sync for the new response fields.
- Do not touch `HTTP_PROBE` floors, retry headers, or the outbox publisher.

## Acceptance criteria

- A monitor with security checks on gets a `SECURITY_POSTURE` scan roughly every 24 h; with DNS watch on, a `DNS_WATCH` scan
  roughly every 6 h; with both off, none. `HTTP_PROBE` cadence is unchanged.
- Turning a check on schedules its first run one interval later; turning it off clears the schedule and stops runs.
- Existing enabled monitors do not all fire on the first poll after the migration (backfill is spread).
- Two scheduler instances running at once create at most one scan per due occurrence.
- At the workspace limit, or with a scan already in flight, an occurrence is skipped, the schedule advances, and the cycle does
  not fail.
- An inactive monitor gets no scheduled scan of any kind.
- A redelivered job for a scheduled scan behaves like any other (no second finding set, no second DNS baseline).
- `GET`/`PATCH` check-settings return `securityNextScanAt` and `dnsNextScanAt`; a `MEMBER` can read, only `OWNER`/`ADMIN` can
  change, and a user outside the workspace still gets `404`.
- `docs/security-checks.md` and `docs/architecture.md` describe the intervals and the skip rules.

## Checks to run

`moon run api:typecheck`, `moon run api:test`, `moon run api:coverage` (thresholds unchanged), `pnpm --filter @ontapulse/api
test:db:migrate` before the tests, `moon run worker:test` (no code change, confirms the contract), `pnpm format:check` on changed
files, `git diff --check`. Run `worker:integration-test` only if infrastructure is up.

## Exact manual test steps expected after implementation

1. `docker compose up -d`, `docker compose ps` until healthy. Run the migration. Start `moon run api:dev` and `moon run worker:dev`.
2. Use only a target you own (the worker rejects private addresses). Create a monitor and turn security checks on.
3. `GET /api/monitors/:id/check-settings`: `securityNextScanAt` is about 24 h ahead, `dnsNextScanAt` is `null`.
4. To see a run without waiting, set `securityNextScheduledAt` to a past time in the dev database (never in a shared or
   production database). Within about 10 s the API log shows `Scan scheduler run completed` with the security count, and a
   `SECURITY_POSTURE` scan appears in the scan list and finishes in the worker. `securityNextScanAt` moves 24 h ahead.
5. Repeat with DNS watch: the first scheduled DNS scan after the manual one produces no change finding if nothing changed.
6. Turn the check off: `securityNextScanAt` becomes `null`; forcing the old time again creates no scan.
7. Deactivate the monitor: no scans of any kind.
8. Roles: `MEMBER` can read check-settings and cannot `PATCH`; a user outside the workspace gets `404`.
9. Watch the API log (counts only, no target secrets), the worker log (one scan per occurrence), and the RabbitMQ UI (no backlog).

State plainly at the end what could not be verified (for example behavior over a real 24 h period).

## Security requirements

- No change to what a scan requests or stores. Scheduled scans are the same jobs as manual ones, so SSRF validation, request
  budgets, evidence sanitization, challenge suppression, and path-probe opt-in apply unchanged.
- The scheduler never bypasses the path-probe acknowledgment: it creates a scan, and the worker reads the setting when it
  claims it.
- Logs carry counts and ids only.
- No new env vars, no new dependency.

## Safety review (scanner phase)

- **Requests per scan and paths:** unchanged. Posture: at most 2 HTTP requests plus 1 TLS handshake, plus the allowlisted
  paths only if path probes are enabled and acknowledged. DNS: at most 40 queries to the configured public resolvers, no
  contact with the host.
- **New load on targets:** one posture scan per monitor per 24 h and one DNS scan per 6 h, down from "whenever a person clicks"
  only in the sense of being automatic. The catalog minimum of 3600 s is enforced by constants being above it, with a test.
  Path probes recur at most once per 24 h per monitor.
- **Read from responses, stored, redacted:** unchanged (header names, cookie names and flags, bounded non-secret values; no
  bodies or cookie values).
- **SSRF:** unchanged; each connection is validated by the worker and connects to the validated address.
- **Opt-in:** enabling a check is the opt-in for recurring runs (decision 2). Path probes keep their separate acknowledgment.
- **Load bound:** per-workspace limit of 60 scans per hour per kind applies to scheduled runs; skipped occurrences are counted
  in the log so operators can see saturation.

## Result

Branch: `feat/recurring-security-dns-scans` (from `main` at `035a7dd`). Not committed or pushed yet.

Implemented as planned: migration `20261023090000_add_check_schedules` (two nullable columns, two indexes, spread backfill),
`SCHEDULED_KINDS` and the interval constants in `scan-kinds.ts`, a check pass in the scheduler (`CheckSchedulerRepository`,
`ScanSchedulerService`), the shared non-throwing workspace-limit helper in `scan.repository.ts`, schedule set and cleared on
toggle in the check-settings repository, `securityNextScanAt` and `dnsNextScanAt` in the check-settings responses, docs in
`architecture.md` and `security-checks.md` (sections 4 and 12).

Differences from the prompt:

- The check pass logs its own event, `Check scan scheduler run completed`, instead of extending `Scan scheduler run completed`.
  Existing scheduler tests assert the exact context of the availability event, and the HTTP pass had to stay unchanged.
- `scheduleFor` is exported from the check-settings repository so the rule is unit-visible; no behavior difference.
- One existing test (`security-checks.test.ts`, "reports every check as disabled") asserted the exact response body, so it now
  includes the two new null fields. The change is additive for clients.

Checks run: `api:typecheck` (pass); `prisma migrate diff` migration vs schema (no difference); API tests (246 pass, including
11 new scheduler tests and 4 new toggle tests); worker pytest through the existing venv (all pass, no code change).

Not verified:

- `api:coverage` fails the global 90% threshold (statements 79.4%, lines 80.2%). The uncovered files are ones this phase did not
  touch (`server.ts`, the queue and session infrastructure, the monitors controller, `scan-scheduler.ts`); the files changed here
  are covered. I did not run the same command on `main`, so I cannot say whether the shortfall already existed.
- `moon run worker:test` could not run: `worker:sync` failed with "There is not enough space on the disk" on the `uv` cache drive.
  The worker tests were run directly with `apps/worker/.venv`.
- No manual run against a real broker and worker, and nothing over a real 24 h period.

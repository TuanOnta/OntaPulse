# Phase 1 — Scan kind plumbing

Branch: `security/phase-1-scan-kind-plumbing` (from `master` at `7de8b93`). Apps touched: api, worker, docs.
No new check runs in this phase. `HTTP_PROBE` behavior and tests stay unchanged.

## 1. Goal

Add the storage and dispatch plumbing the later phases need:

1. Prisma migration: scan kind, additive finding fields, monitor check settings.
2. Worker: read the scan kind from the `Scan` row and dispatch through a registry. Only `HTTP_PROBE` is registered.
3. API: expose the new fields additively, and let a trigger carry an optional kind that is rejected until the kind is available.

## 2. References read

- Root `AGENTS.md` (sections 2, 7, 9, 10, 16), `apps/api/AGENTS.md`, `apps/worker/AGENTS.md`.
- `docs/security-checks.md` (sections 2, 3, 12), `docs/queue-contract.md`, `docs/architecture.md`.

## 3. Existing code inspected

API:

- `prisma/schema.prisma`: `Scan` has no `kind`; `ScanFinding` has `code`, `title`, `severity`, `description`,
  `recommendation`, `evidence Json?`; `Monitor` has `intervalSeconds`, `isActive`, `nextScheduledAt`.
- `modules/scans`: `scan.repository.ts` (`create(monitorId)` makes `Scan` + `ScanOutboxEvent` in one transaction),
  `scan.service.ts` (`trigger` requires `OWNER`/`ADMIN`, returns 404 outside the workspace), `scan.openapi.ts`
  (response schemas list properties explicitly, so Fastify serialization **drops any field not declared**),
  `scan-scheduler.repository.ts` (creates scans with the default kind).
- Latest migration is `20261002090000_complete_scan_outbox`.

Worker:

- `modules/scans/application/scan_lifecycle.py`: `ScanLifecycleService(repository, executor)`; `handle` claims,
  executes, `succeed`/`fail`, releases on unexpected errors.
- `modules/scans/domain/models.py`: `ClaimedScan(scan_id, target_url)`, `ScanFinding`, `ScanResult`.
- `modules/scans/adapters/sqlalchemy_scan_repository.py`: raw SQL; `LOAD_SCAN_FOR_UPDATE`, `INSERT_SCAN_FINDING`.
- `bootstrap/container.py`: builds `HttpScanExecutor` and the lifecycle service.
- `adapters/rabbitmq/consumer.py`: `PermanentScanJobError` and `InvalidScanMessage` go to the dead-letter queue.
- Existing tests build `ClaimedScan(scan_id=..., target_url=...)` and `ScanLifecycleService(repository, executor)`.

## 4. Decisions and assumptions (veto any)

| #   | Decision                                                                                                                                                                                                                                                                                                           | Why                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| D1  | New enum `ScanKind` (`HTTP_PROBE`, `SECURITY_POSTURE`, `DNS_WATCH`); `Scan.kind ScanKind @default(HTTP_PROBE)`. Existing rows and the scheduler keep the default.                                                                                                                                                  | Catalog section 2; additive.                                                                |
| D2  | New enums `FindingCategory` (`HEADERS`, `COOKIES`, `CORS`, `REDIRECT`, `TLS`, `EXPOSED_FILES`, `DNS`, `EMAIL_AUTH`) and `FindingConfidence` (`LOW`, `MEDIUM`, `HIGH`). New nullable `ScanFinding.checkId`, `category`, `confidence`.                                                                               | Catalog sections 5, 12. Nullable so existing rows need no backfill.                         |
| D3  | `HTTP_PROBE` findings keep `checkId`, `category`, `confidence` = `NULL`. Their `code` is unchanged. For new findings the worker will set `code = checkId` (later phases).                                                                                                                                          | Keeps `HTTP_PROBE` rows and output unchanged. No `HTTP` category needed.                    |
| D4  | New table `MonitorCheckSettings` (one row per monitor, `monitorId` unique, cascade delete): `securityPostureEnabled`, `dnsWatchEnabled`, `pathProbesEnabled` (all default `false`), `pathProbesAcknowledgedById` (nullable FK to `User`, `SetNull`), `pathProbesAcknowledgedAt` (nullable). No row = all defaults. | Root section 7. Separate table avoids widening `Monitor`; rows are created lazily.          |
| D5  | **No settings routes in this phase.** The table exists but nothing writes it. Routes to enable kinds and path probes land with the first phase that uses them (Phase 2 for posture, Phase 5 for probes).                                                                                                           | Keeps phase small; no UI or check consumes them yet.                                        |
| D6  | A shared constants module `src/modules/scans/scan-kinds.ts` defines `SCAN_KINDS` and `AVAILABLE_SCAN_KINDS = ["HTTP_PROBE"]`. Schemas, service, and tests import it.                                                                                                                                               | `apps/api/AGENTS.md`: define once, reuse.                                                   |
| D7  | `POST /monitors/:monitorId/scans` accepts an **optional** JSON body `{ "kind": ScanKind }`. No body or empty body = `HTTP_PROBE`, exactly as today. A kind not in `AVAILABLE_SCAN_KINDS` returns `400` with code `SCAN_KIND_NOT_AVAILABLE`.                                                                        | Backward compatible; prevents queuing jobs no worker can run.                               |
| D8  | Scan responses (`POST` 202, list, detail) gain `kind`. Finding objects in scan detail gain `checkId`, `category`, `confidence` (nullable). Added to `properties` and `required` in the response schemas.                                                                                                           | Additive; Fastify drops undeclared fields.                                                  |
| D9  | Worker `ClaimedScan` gains `kind: ScanKind = HTTP_PROBE`; `ScanFinding` gains `check_id`, `category`, `confidence`, all default `None`. `ScanLifecycleService(repository, executor)` keeps working: the second argument becomes the `HTTP_PROBE` executor, and an optional keyword `executors` maps further kinds. | Existing tests pass unchanged.                                                              |
| D10 | Unknown or unregistered kind: the lifecycle marks the scan `FAILED` with a safe message (`Unsupported scan kind.`), then raises `PermanentScanJobError`, so the message goes to `scan.jobs.dead`. The claim's later release is a no-op because the scan is no longer `RUNNING`.                                    | Docs: unknown kinds are permanent errors; scan must not stay `RUNNING` or `QUEUED` forever. |
| D11 | Finding insert writes `checkId`, `category`, `confidence`. Evidence size limit (4 KB, catalog section 5) is enforced in the worker repository for **non-null new-style findings only**; `HTTP_PROBE` evidence is untouched.                                                                                        | Avoids changing `HTTP_PROBE` behavior.                                                      |
| D12 | The executor port `ScanExecutor.execute(target_url)` stays for `HTTP_PROBE`. The richer execution interface for posture and DNS checks is designed in Phase 2 when the first such check exists.                                                                                                                    | Avoid speculative abstractions.                                                             |
| D13 | The DNS baseline and edge profile tables are **not** created here. They land with Phase 4 and Phase 6, which are their only users.                                                                                                                                                                                 | Smaller migration; avoids unused tables.                                                    |
| D14 | Catalog categories `HEADERS`..`EMAIL_AUTH` are created now (used by Phase 2+) because enum values cannot be removed cheaply and the catalog fixes them.                                                                                                                                                            | Catalog section 12.                                                                         |

## 5. Contract changes and sync list

| Contract                   | Change                                                                                                                        | Apps                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Prisma schema              | `ScanKind`, `FindingCategory`, `FindingConfidence`, `Scan.kind`, three nullable `ScanFinding` columns, `MonitorCheckSettings` | api (owner), worker (reads `kind`, writes finding columns) |
| `POST /monitors/:id/scans` | Optional body `{ kind }`; new `400 SCAN_KIND_NOT_AVAILABLE`; response gains `kind`                                            | api, web client (no change needed; extra field ignored)    |
| `GET` scan list / detail   | Response gains `kind`; detail findings gain `checkId`, `category`, `confidence`                                               | api, web (types updated later)                             |
| Queue payload / topology   | **None.** Payload stays `{ scanId, monitorId }`.                                                                              | none                                                       |
| Docs                       | `docs/queue-contract.md` and `docs/security-checks.md` updated where Phase 0 said "planned" for these items                   | docs                                                       |

Web: no code change in this phase. `shared/types/domain.ts` additions are deferred to the first web phase that
displays them; the extra response fields are ignored by the current client. Stated here so it is a decision, not an omission.

Order inside the one branch: docs, API migration and routes, worker.

## 6. Files likely to change

API:

- `prisma/schema.prisma`, new `prisma/migrations/<timestamp>_add_scan_kind_and_finding_fields/migration.sql`
- `src/modules/scans/scan-kinds.ts` (new), `scan.schema.ts`, `scan.openapi.ts`, `scan.controller.ts`,
  `scan.service.ts`, `scan.repository.ts`
- `test/scan.test.ts` (extend), `test/helpers/database.ts` (clean `MonitorCheckSettings` if needed)
- Never edit `src/generated/`; regenerate with `prisma generate`.

Worker:

- `modules/scans/domain/models.py` (`ScanKind`, fields), `domain/errors.py` (none expected)
- `modules/scans/application/scan_lifecycle.py`, `application/ports.py` (unchanged unless needed)
- `modules/scans/adapters/sqlalchemy_scan_repository.py` (load `kind`, insert new finding columns)
- `bootstrap/container.py` (registry)
- Tests mirror paths under `tests/unit/modules/scans/...`

Docs: `docs/queue-contract.md`, `docs/security-checks.md` (section 12 status), `docs/architecture.md` (status wording).

## 7. Implementation requirements

1. **Migration** is one new file; no edit of applied migrations. Columns are nullable or defaulted. Enum
   additions follow the Prisma naming of the existing migrations. Check the generated SQL by hand before applying.
   Rollout order: API migration first, then worker (the worker only reads `kind` after the column exists).
2. **Worker compatibility during rollout**: an old worker against the new schema must keep working (new columns
   have defaults and are not required by its SQL). A new worker against an old schema is not supported.
3. **Trigger**: parse the optional body with Zod and the matching Fastify JSON Schema, which must accept exactly
   the same input. An absent body, `{}`, and `{"kind":"HTTP_PROBE"}` behave identically to today.
4. **Authorization** unchanged: `OWNER`/`ADMIN` trigger; `MEMBER` gets `404` as today (existing behavior kept);
   outsiders get `404`.
5. **Scheduler** untouched; it keeps creating default-kind scans.
6. **Lifecycle dispatch** in the worker: look up `executors[claimed.kind]`; `HTTP_PROBE` goes through the
   unchanged path (`evaluate_scan_result`, `succeed`, `ScanExecutionError` to `fail`).
7. **Persistence**: `INSERT_SCAN_FINDING` includes `"checkId"`, `category`, `confidence` as `NULL` for
   `HTTP_PROBE`. Parameters for enum columns are cast in SQL.
8. **Log fields**: add `scan_kind` to the structured lifecycle log fields. No other log change.
9. No new dependency, env var, queue, or setting.

## 8. Safety review

No scanner behavior is added. No new request, connection, or path. The only network-facing change is that a
trigger may name a kind, and non-available kinds are rejected before anything is queued. Evidence sanitization and
size bounds are enforced in code for new-style findings, ready for Phase 2. No external service receives data.
SSRF validation is untouched.

## 9. Acceptance criteria

- `prisma migrate` applies cleanly on the test database; existing scans read `kind = HTTP_PROBE`.
- An `HTTP_PROBE` trigger with no body returns the same status and the same fields as before plus `kind`.
- `POST` with `{ "kind": "SECURITY_POSTURE" }` returns `400 SCAN_KIND_NOT_AVAILABLE` and creates no scan and no
  outbox event.
- A `MEMBER` gets `404` as today; an outsider gets `404`.
- Scan list and detail include `kind`; detail findings include `checkId`, `category`, `confidence` (`null` for
  `HTTP_PROBE` findings).
- Worker: a scan row with `kind = HTTP_PROBE` runs exactly as before; a row with another kind is marked `FAILED`
  and the delivery goes to the dead-letter queue; no second set of findings on redelivery.
- Existing API and worker tests pass without modification (new tests are added, none edited to make them pass,
  except where a response now has the extra `kind` field and the test used strict equality; each such edit is
  listed in the Result section).
- Coverage thresholds unchanged and met.

## 10. Checks to run

- `pnpm --filter @ontapulse/api exec prisma generate`
- `pnpm --filter @ontapulse/api test:db:migrate`
- `moon run api:typecheck`, `moon run api:test`
- `moon run worker:lint`, `moon run worker:format-check`, `moon run worker:test`
- `moon run worker:integration-test` only if Docker infra is up (the change touches the repository and dispatch).
- `pnpm format:check` (known repo-wide failures in `references/` are reported, not fixed), `git diff --check`.

## 11. Manual test steps

1. `docker compose up -d`, `docker compose ps` (healthy).
2. `pnpm --filter @ontapulse/api exec prisma migrate dev` (dev database), then `moon run api:dev`,
   `moon run worker:dev`, `moon run web:dev`.
3. Open `http://localhost:5173`, sign in, open a monitor, run a scan. Expected: unchanged behavior, scan reaches
   `SUCCEEDED` or `FAILED` as before.
4. Swagger at `http://localhost:3000/docs`: the scan response schemas show `kind`; finding schema shows
   `checkId`, `category`, `confidence`.
5. With curl (session cookie) `POST /api/monitors/<id>/scans` body `{"kind":"SECURITY_POSTURE"}`. Expected: `400`
   `SCAN_KIND_NOT_AVAILABLE`; RabbitMQ UI shows no new message.
6. Roles: `MEMBER` trigger returns `404`; an outsider returns `404`.
7. Dead-letter check (dev database only, never shared data): update one `QUEUED` scan's `kind` to
   `SECURITY_POSTURE` directly in SQL, publish its job; expect the scan `FAILED` and one message in
   `scan.jobs.dead`. Optional; skipped if no safe dev environment is available.
8. Watch: API and worker terminals (log field `scan_kind`), RabbitMQ UI, browser network tab.

## 12. Security requirements

No secrets in code or logs. No new env vars. Validate the body at the route boundary. Error messages stay generic.
The settings table stores user ids only, never target data. No cookie values, tokens, or bodies are touched.

## Result

Implemented on `master` at the user's request (the prompt called for a branch; the user chose `master`).

- API: migration `20261015090000_add_scan_kind_and_finding_fields`, `Scan.kind`, finding `checkId`/`category`/`confidence`, `MonitorCheckSettings`, optional trigger body `{ kind }`, `SCAN_KIND_NOT_AVAILABLE`, `kind` and finding fields in responses. Prisma client regenerated.
- Worker: `ScanKind`, kind read at claim, dispatch registry in `ScanLifecycleService`, unsupported kind fails the scan and dead-letters, finding insert writes the new columns, 4 KB evidence bound for catalog findings.
- Docs: `queue-contract.md`, `architecture.md`, `security-checks.md`.

Corrections to this prompt:

- Section 9 says a `MEMBER` gets `404` on trigger. Actual and unchanged behavior: an in-workspace `MEMBER` gets `403 INSUFFICIENT_WORKSPACE_ROLE`; only a user outside the workspace gets `404`. Role and workspace are checked before the kind.
- A request without a body needed a `preValidation` default (`request.body ??= {}`), otherwise Fastify rejects it with `must be object`.
- Edited existing tests (strict equality, now include `kind: "HTTP_PROBE"`): `scan.test.ts` "creates a queued scan" and "returns a queued scan without findings". No worker test was edited.

Checks run: `api:typecheck` pass, `api:test` 153 passed, `worker:lint`, `worker:format-check` pass, `worker:test` 106 passed.

Not verified:

- `worker:integration-test` was started and hung with no output for about 10 minutes; it was stopped. The repository and dispatch changes are not covered at integration level.
- `api:coverage` fails the thresholds (about 72% lines vs 90%). It fails the same way before this change (71.5% measured with the change stashed), so it is not a regression.
- `pnpm format:check` fails repo-wide on unrelated files; `git diff --check` flags trailing whitespace only in generated `src/generated/prisma/*`.
- Manual steps in section 11 (dev server, dead-letter check) were not run.

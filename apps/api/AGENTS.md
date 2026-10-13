# OntaPulse API (`apps/api`)

Fastify 5 + TypeScript (ESM) + Prisma 7 (PostgreSQL) + Redis sessions + RabbitMQ producer. Read the root `AGENTS.md` and `README.md` first; this file only adds API-specific rules. Where the root file is web-specific (reference prototypes, Three.js, FSD), it does not apply here. The root sections on scanner safety (8), build order (9), and queue and scan execution (10) do apply.

Source of truth (do not duplicate):

- HTTP contracts: route schemas and Swagger UI at `/docs`.
- Data model: `prisma/schema.prisma`. The API owns the schema.
- Queue payload and topology: `../../docs/queue-contract.md`.
- Check catalog (finding IDs, severities, thresholds, budgets, minimum intervals, path allowlist): `../../docs/security-checks.md`.
- Architecture: `../../docs/architecture.md`.

## Scope

- Work here only when the user asks for an API change. A change to routes, schema, or error shapes affects the web client and the worker: say so and ask before changing a contract.
- Contract changes are additive. Existing routes, response shapes, and the `HTTP_PROBE` behavior keep working. A breaking change needs the user's explicit approval.
- Never edit `src/generated/` (Prisma Client output). Regenerate with `pnpm --filter @ontapulse/api exec prisma generate`.
- Never edit an applied migration in `prisma/migrations/`. Add a new one (`prisma migrate dev --name <name>`).
- `src/modules/notifications/` is empty on purpose. Notifications are not built; do not add them unasked.
- The API never runs a check. It stores the request, enforces authorization, publishes the job, and serves stored results.

## Layout and layering

```text
src/
  app.ts, server.ts     App factory and process entry
  config/               env.schema.ts (Zod) and env.ts
  infrastructure/       database, errors, logger, queue, redis, session
  plugins/              authenticate, error-handler, health
  modules/<name>/       auth, users, workspaces, projects, monitors, scans, operations,
                        domain-watch (DNS baseline and change history; added in its phase)
```

Module flow: `route -> controller -> service -> repository -> Prisma`.

- Routes: register paths, JSON Schema, and OpenAPI docs (`*.openapi.ts`, `*.schema.ts`).
- Controllers: parse the request, call the service, shape the response. No business rules.
- Services: business rules, authorization by workspace role, coordination. No Prisma imports.
- Repositories: the only layer that calls Prisma.
- Fastify JSON Schema and Zod must accept exactly the same input.
- Files are kebab-case with role suffixes (`scan.service.ts`). ESM imports use `.js` extensions in TypeScript source.
- Scan kinds, finding categories, and check IDs are defined once (a shared constants module) and reused by schemas, services, and tests. Do not scatter string literals.

## Domain rules the API enforces

- Roles are per workspace (`OWNER`, `ADMIN`, `MEMBER`). The permission table is in the root `AGENTS.md` and `README.md`; the API decides, the UI never does.
- Resources outside the caller's workspaces return `404`, never `403`, so existence is not leaked. This covers every new route: scan results, findings, edge profile, DNS baseline, and monitor check settings.
- Scan trigger: create `Scan` (`QUEUED`) with its `kind` (default `HTTP_PROBE`) and the outbox event in one transaction, return `202`. The outbox publisher marks an event `PUBLISHED` only after a RabbitMQ publisher confirm, and retries on lease expiry or failure.
- Security and DNS checks per monitor:
  - Enabling or disabling a scan kind for a monitor and triggering a security or DNS scan: `OWNER` and `ADMIN` only. `MEMBER` can read results.
  - Path probes (exposed-file checks) are off by default. Enabling needs `OWNER` or `ADMIN` plus an explicit acknowledgment in the request. Store who acknowledged and when. Disabling does not need one. A request that enables probes without the acknowledgment is rejected.
  - Minimum interval and per-workspace limits for security and DNS scans come from the catalog constants, not from the 60 s `HTTP_PROBE` floor. Reject a trigger or schedule below the minimum with a validation error.
- Findings and observations returned by the API include `checkId`, category, severity, confidence when present, and sanitized evidence. The API never adds or reads secrets: if the worker stored a value that looks like a cookie value, token, or body content, that is a bug; do not pass it through.
- Monitor `intervalSeconds`: integer 60-86400, default 300. Target URL is unique per project. Only `http` and `https`.
- Registration: name 2-80 chars, email lowercased, password 12-128 chars. Passwords use Argon2id. Session cookie is `ontapulse_session` (`httpOnly`, 7 days, stored in Redis).
- Error contract: `statusCode`, `code`, `message`, optional `details`, `requestId`. Unexpected errors return a generic message. Never leak stack traces, credentials, cookies, or connection strings, in responses or logs.

## Schema and migration rules

- The schema change for a phase lands in one migration set, reviewed together with the worker change that reads it. The worker reads new columns through SQLAlchemy; keep column names and enums stable once the worker depends on them.
- New columns on existing tables are nullable or have defaults so existing rows and the running worker keep working during rollout.
- Enums for scan kind and finding category are extended, never renamed. Severity keeps `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- Evidence is a bounded JSON column. Enforce size limits in the service, not only in the worker.
- DNS baseline: one current baseline per monitored host plus a bounded change history. The worker is the only writer of the baseline; the API only reads it.

## Queue producer

- The RabbitMQ connection is lazy; the API may start with the broker down, but scan triggering needs it.
- Payload is `{ scanId, monitorId }` only. The scan kind is read by the worker from the `Scan` row, never sent in the payload. Retry count lives in the `x-scan-retry-count` header, owned by the worker.
- Changing payload or topology means updating producer, worker consumer, tests, and `docs/queue-contract.md` together. Stop and ask first.

## Security

- No secrets in code or logs. Env is read through `src/config/env.ts`, validated by Zod. New env vars go to `.env.example` and the Zod schema together, after asking.
- Validate every input at the route boundary. Do not trust path or body ids without a workspace membership check in the service.
- Seed (`prisma/seed.ts`) refuses to run outside development, on a non-local database, or on a database that looks like a test database. Keep those guards.
- Never reset or clean a database unless `NODE_ENV=test` and the target is the dedicated `_test` database.
- Target URL validation at the API is a first filter only. The worker's SSRF validation is authoritative. Do not relax either.

## Tests

- Vitest, files in `test/*.test.ts`, helpers in `test/helpers/`. `fileParallelism` is off because tests share the test database.
- `.env.test` is used, never `.env`. Use a fake or no-op queue unless a test explicitly needs a real broker.
- New behavior gets tests next to the matching area (`auth`, `workspace`, `projects`, `monitor`, `scan`, `security-checks`, `domain-watch`, `resource-authorization`, ...). Cover the `404` isolation and each role (`OWNER`, `ADMIN`, `MEMBER`) for every permission change, including the path-probe acknowledgment.
- Add a regression test that an `HTTP_PROBE` trigger and its response shape are unchanged after each phase.
- Coverage thresholds in `vitest.config.ts` (statements 90, branches 65, functions 90, lines 90). Do not lower them.

## Commands (repo root)

| Task                   | Command                                        |
| ---------------------- | ---------------------------------------------- |
| Dev server (port 3000) | `moon run api:dev`                             |
| Type-check             | `moon run api:typecheck`                       |
| Tests                  | `moon run api:test`                            |
| Coverage               | `moon run api:coverage`                        |
| Test DB migrations     | `pnpm --filter @ontapulse/api test:db:migrate` |
| Seed dev data          | `pnpm --filter @ontapulse/api db:seed`         |
| Format check           | `pnpm format:check`                            |
| Whitespace             | `git diff --check`                             |

Run `api:typecheck`, `api:test`, `pnpm format:check`, and `git diff --check` before reporting done. If a schema field changed that the worker reads, also run `moon run worker:test`. Report real output; say plainly what was not run.

## Workflow and language

- Follow the root workflow: inspect code, write a prompt file in `prompts/`, get approval, implement, check, share manual test steps. Tiny fixes may skip the prompt.
- One branch per task, conventional commits (`feat(api): ...`), no commits or pushes unless asked.
- Reply to the user in Bahasa Indonesia. Code, comments, commits, and prompt files in English.

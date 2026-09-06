# Development

## Initial setup

From the repository root, copy `.env.example` to `.env` and replace the placeholder passwords. The repository uses `uv` for Python dependency management. Then run:

```bash
pnpm install
docker compose up -d
pnpm --filter @ontapulse/api exec prisma migrate dev
```

Run the API:

```bash
moon run api:dev
```

Open Swagger at `http://localhost:<API_PORT>/docs`.

## Environment

Keep local secrets in `.env` and test values in `.env.test`; neither file should be committed. Maintain a committed `.env.example` containing names and safe placeholders.

| Variable                                                             | Purpose                                           | Required in test                             |
| -------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| `NODE_ENV`                                                           | Selects development, test, or production behavior | Yes; must be `test`                          |
| `API_PORT`                                                           | Fastify listening port                            | Yes                                          |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Compose PostgreSQL configuration                  | Yes                                          |
| `DATABASE_URL`                                                       | Prisma connection string                          | Yes; must target the dedicated test database |
| `REDIS_PORT`, `REDIS_URL`                                            | Redis port and application URL                    | Yes                                          |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD`                                 | Compose broker credentials                        | No                                           |
| `RABBITMQ_PORT`                                                      | Host AMQP port, normally `5672`                   | No                                           |
| `RABBITMQ_MANAGEMENT_PORT`                                           | Host management UI port, normally `15672`         | No                                           |
| `RABBITMQ_URL`                                                       | API AMQP connection string                        | No                                           |

When the API runs on the host, broker URLs normally use `127.0.0.1`. Containers use Compose service names such as `postgres`, `redis`, and `rabbitmq`.

If a RabbitMQ password contains reserved URL characters, percent-encode it in `RABBITMQ_URL`. Do not commit real credentials.

## Local infrastructure

`docker compose up -d` starts PostgreSQL, Redis, and RabbitMQ. Check their health with:

```bash
docker compose ps
```

RabbitMQ exposes AMQP on `RABBITMQ_PORT` and its management UI on `RABBITMQ_MANAGEMENT_PORT`. With `.env.example`, the UI is available at `http://localhost:15672`.

The API creates and binds the scan exchanges and queues on its first enqueue. A healthy API process does not by itself prove that RabbitMQ is reachable because the connection is lazy. Trigger a scan or inspect the broker UI when diagnosing queue connectivity.

## Commands

| Task                        | Command                                        |
| --------------------------- | ---------------------------------------------- |
| Start infrastructure        | `docker compose up -d`                         |
| Inspect infrastructure      | `docker compose ps`                            |
| Run API                     | `moon run api:dev`                             |
| Type-check API              | `moon run api:typecheck`                       |
| Run API tests               | `pnpm --filter @ontapulse/api test`            |
| Watch API tests             | `pnpm --filter @ontapulse/api test:watch`      |
| Apply test migrations       | `pnpm --filter @ontapulse/api test:db:migrate` |
| Seed local database         | `pnpm --filter @ontapulse/api db:seed`         |
| Format files                | `pnpm format`                                  |
| Check formatting            | `pnpm format:check`                            |
| Install worker dependencies | `cd apps/worker && uv sync --locked`           |
| Check worker database       | `moon run worker:check-db`                     |
| Run worker tests            | `moon run worker:test`                         |
| Lint worker                 | `moon run worker:lint`                         |
| Check worker formatting     | `moon run worker:format-check`                 |

## Database changes

1. Edit `apps/api/prisma/schema.prisma`.
2. Create and apply a development migration with Prisma Migrate.
3. Regenerate Prisma Client if the command does not do so automatically.
4. Apply existing migrations to the test database.
5. Run type-checking and tests.

Do not manually edit generated Prisma Client files or an already-applied migration.

## Development seed

Run `pnpm --filter @ontapulse/api db:seed` after applying migrations to populate a local development database with deterministic fake data. The seed creates two projects, three monitors, four scans covering every status, and four findings covering every severity.

The script uses fixed UUIDs and `upsert`, so repeated runs update the seeded records without duplicating or deleting other data. It refuses to run unless `NODE_ENV=development`, the PostgreSQL host is local, and the database name does not end in `_test`. It must never be used as a production data migration.

## Worker foundation

The Python worker package lives under `apps/worker/ontapulse_worker`. It reads the root `.env` in development and production, or `.env.test` when `NODE_ENV=test`. Only `NODE_ENV`, `DATABASE_URL`, and `RABBITMQ_URL` are consumed by the worker. RabbitMQ is optional in test mode so unit tests do not require a broker.

Worker code is grouped by feature, with shared technical facilities kept in `platform`:

```text
ontapulse_worker/
  modules/scans/   Scan domain, application ports/services, and inbound/outbound adapters
  platform/        Shared configuration, database, messaging, and logging
  bootstrap/       Dependency composition and resource ownership
  entrypoints/     Worker process and database readiness command
```

Run `moon run worker:check-db` to validate configuration and execute `SELECT 1` against PostgreSQL. The command emits only a structured readiness event, never prints connection strings or credentials, and applies a five-second connection timeout. It exits after the check. `moon run worker:dev` starts the consumer through `entrypoints/worker.py`; `bootstrap/container.py` composes its dependencies. This structural separation does not add bounded retries.

The worker database lifecycle locks a matching Scan row before changing `QUEUED` to `RUNNING`. Completed scans are handled idempotently, a job whose Scan and Monitor do not match is permanent, and unexpected infrastructure failures return the claimed Scan to `QUEUED`. Such failures are retried after 5, 30, and 120 seconds before reaching the dead-letter queue. Expected GET failures are stored as `FAILED` and ACKed. Terminal updates require the Scan to remain `RUNNING`, preventing stale work from overwriting another state transition.

SQLAlchemy uses psycopg 3. The shared `postgresql://` URL is normalized to `postgresql+psycopg://` inside the worker, so `.env` remains compatible with Prisma and the Python service.

## Tests

- Integration tests call `Fastify.inject()` and do not start a TCP server.
- `.env.test` must point to a dedicated test database.
- Database cleanup is allowed only when `NODE_ENV=test`.
- Delete child records before parents to satisfy foreign keys.
- Database-backed test files run serially to prevent one file resetting another file's data.
- RabbitMQ is replaced with a fake queue in application tests.
- Infrastructure tests that use real PostgreSQL or RabbitMQ must be clearly separated.
- Worker unit tests must construct engines without opening real PostgreSQL connections.

`buildApp()` defaults to `NoopScanQueue`, so ordinary application tests never open a broker connection. Scan integration tests inject `FakeScanQueue` to assert the exact `{ scanId, monitorId }` job, simulate publish failures, verify the persisted `FAILED` state, and confirm queue shutdown.

The expected local workflow is:

```bash
pnpm --filter @ontapulse/api test:db:migrate
moon run api:typecheck
pnpm --filter @ontapulse/api test
pnpm format:check
```

## Adding an API module

Create only the layers the feature needs:

```text
<feature>.schema.ts
<feature>.repository.ts
<feature>.service.ts
<feature>.controller.ts
<feature>.openapi.ts
<feature>.routes.ts
```

Then register the routes under the `/api` prefix and add integration tests for success, validation boundaries, missing resources, conflicts, response shape, and resource isolation.

## Code conventions

- Prettier controls formatting; the repository configuration is authoritative.
- Prefer one line when an expression fits the configured width.
- Use structured logging: `request.log.info({ scanId }, "Scan queued")`.
- Keep expected test output quiet by disabling the Fastify logger under `NODE_ENV=test`.
- Use exact, stable application error codes rather than testing human-readable text alone.

## Queue development rules

- Depend on `ScanQueue` from services; keep `amqplib` inside the infrastructure implementation.
- Keep the message payload limited to identifiers defined by `queue-contract.md`.
- Wait for publisher confirmation before returning `202`.
- Close queue resources through the Fastify `onClose` lifecycle.
- Use fake dependencies in application tests; do not make a live broker a default test prerequisite.
- Update `queue-contract.md`, producer, consumer, and tests together before changing topology or payload.

## Common failures

| Symptom                                           | Check                                                                                                                                               |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| API fails environment validation                  | Compare `.env` with `.env.example`; RabbitMQ variables are required outside test mode                                                               |
| Worker emits `worker.database_unavailable`        | Start Docker Desktop, check `docker compose ps postgres`, and verify `DATABASE_URL`                                                                 |
| Scan trigger returns `503 SCAN_QUEUE_UNAVAILABLE` | Check `docker compose ps`, broker credentials, `RABBITMQ_URL`, and port mapping                                                                     |
| Scan remains `QUEUED`                             | This is expected until the worker entrypoint is activated; otherwise inspect consumer health and the `scan.jobs` queue                              |
| Tests attempt to use development data             | Ensure `NODE_ENV=test` and verify that `DATABASE_URL` names the dedicated test database                                                             |
| Queue definitions conflict on startup             | Remove the incompatible development queue only after verifying it contains no needed messages; production topology changes require a migration plan |

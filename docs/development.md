# Development

## Initial setup

From the repository root, copy `.env.example` to `.env` and replace the placeholder passwords.

The repository uses:

- pnpm for JavaScript and TypeScript dependencies;
- uv for Python dependencies;
- Moon for monorepo task orchestration;
- Docker Compose for local infrastructure.

Install dependencies and start the infrastructure:

```bash
pnpm install
docker compose up -d
pnpm --filter @ontapulse/api exec prisma migrate dev
pnpm --filter @ontapulse/api db:seed
```

Run the API and worker in separate terminals:

```bash
moon run api:dev
```

```bash
moon run worker:dev
```

Open Swagger at:

```text
http://localhost:<API_PORT>/docs
```

## Environment

Keep development secrets in `.env` and test values in `.env.test`. Neither file should be committed.

Maintain a committed `.env.example` containing variable names and safe placeholder values.

| Variable                                                             | Purpose                                           | Required in test                             |
| -------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------------- |
| `NODE_ENV`                                                           | Selects development, test, or production behavior | Yes; must be `test`                          |
| `API_PORT`                                                           | Fastify listening port                            | Yes                                          |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Compose PostgreSQL configuration                  | Yes                                          |
| `DATABASE_URL`                                                       | Prisma and worker PostgreSQL connection string    | Yes; must target the dedicated test database |
| `REDIS_PORT`, `REDIS_URL`                                            | Redis port and application URL                    | Yes                                          |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD`                                 | Compose RabbitMQ credentials                      | No                                           |
| `RABBITMQ_PORT`                                                      | Host AMQP port                                    | No                                           |
| `RABBITMQ_MANAGEMENT_PORT`                                           | Host RabbitMQ management UI port                  | No                                           |
| `RABBITMQ_URL`                                                       | API and worker AMQP connection string             | No for unit tests                            |
| `WORKER_INFRA_TESTS`                                                 | Explicitly enables worker infrastructure tests    | No                                           |

Applications running directly on the host normally connect through `127.0.0.1`.

Applications running inside Docker Compose use service names such as:

```text
postgres
redis
rabbitmq
```

If a RabbitMQ password contains URL-reserved characters, percent-encode it inside `RABBITMQ_URL`.

Never commit real credentials or print complete connection strings in logs.

## Local infrastructure

Start PostgreSQL, Redis, and RabbitMQ:

```bash
docker compose up -d
```

Inspect container health:

```bash
docker compose ps
```

Inspect the configured host ports:

```bash
docker compose port postgres 5432
docker compose port rabbitmq 5672
docker compose port rabbitmq 15672
```

RabbitMQ exposes:

- AMQP through `RABBITMQ_PORT`;
- the management UI through `RABBITMQ_MANAGEMENT_PORT`.

The API connects to RabbitMQ lazily when the first scan is triggered. Therefore, a running API process does not prove that RabbitMQ is reachable.

The worker connects to PostgreSQL and RabbitMQ when it starts. Recoverable connection failures use exponential backoff with jitter.

## Commands

### Infrastructure

| Task                   | Command                        |
| ---------------------- | ------------------------------ |
| Start infrastructure   | `docker compose up -d`         |
| Inspect infrastructure | `docker compose ps`            |
| Stop infrastructure    | `docker compose stop`          |
| View RabbitMQ logs     | `docker compose logs rabbitmq` |
| View PostgreSQL logs   | `docker compose logs postgres` |

### API

| Task                  | Command                                        |
| --------------------- | ---------------------------------------------- |
| Run API               | `moon run api:dev`                             |
| Type-check API        | `moon run api:typecheck`                       |
| Run API tests         | `pnpm --filter @ontapulse/api test`            |
| Watch API tests       | `pnpm --filter @ontapulse/api test:watch`      |
| Apply test migrations | `pnpm --filter @ontapulse/api test:db:migrate` |
| Seed local database   | `pnpm --filter @ontapulse/api db:seed`         |

### Worker

| Task                        | Command                              |
| --------------------------- | ------------------------------------ |
| Install dependencies        | `cd apps/worker && uv sync --locked` |
| Run worker                  | `moon run worker:dev`                |
| Check database connectivity | `moon run worker:check-db`           |
| Run unit tests              | `moon run worker:test`               |
| Run integration tests       | `moon run worker:integration-test`   |
| Lint worker                 | `moon run worker:lint`               |
| Format worker               | `moon run worker:format`             |
| Check worker formatting     | `moon run worker:format-check`       |

### Repository

| Task             | Command             |
| ---------------- | ------------------- |
| Format files     | `pnpm format`       |
| Check formatting | `pnpm format:check` |
| Inspect changes  | `git diff --check`  |

## Database changes

When changing the database schema:

1. Edit `apps/api/prisma/schema.prisma`.
2. Create and apply a development migration.
3. Regenerate Prisma Client if it is not regenerated automatically.
4. Apply existing migrations to the test database.
5. Run API type-checking and tests.
6. Run worker tests if the changed fields are consumed by the worker.
7. Update documentation when the domain contract changes.

Create a migration:

```bash
pnpm --filter @ontapulse/api exec prisma migrate dev --name <migration-name>
```

Generate Prisma Client:

```bash
pnpm --filter @ontapulse/api exec prisma generate
```

Apply test migrations:

```bash
pnpm --filter @ontapulse/api test:db:migrate
```

Do not manually edit:

- generated Prisma Client files;
- migrations that have already been applied;
- production data as a substitute for a schema migration.

## Development seed

Populate the development database:

```bash
pnpm --filter @ontapulse/api db:seed
```

The seed creates deterministic development records for projects, monitors, scans, and findings.

The seed uses fixed UUIDs and `upsert`, so repeated execution updates the same records without duplicating or deleting unrelated development data.

The seed must refuse to run unless:

- `NODE_ENV=development`;
- PostgreSQL is local;
- the database name is not a test database.

A seed script must never be used as a production data migration.

## Worker architecture

The Python worker lives under:

```text
apps/worker/ontapulse_worker
```

Its source is organized using feature-first hexagonal boundaries:

```text
ontapulse_worker/
  bootstrap/
    container.py

  entrypoints/
    worker.py
    commands/
      database_check.py

  modules/
    scans/
      domain/
        models.py
        errors.py
        policies.py

      application/
        ports/
          scan_executor.py
          scan_repository.py
        services/
          scan_lifecycle.py

      adapters/
        inbound/
          rabbitmq/
            contract.py
            topology.py
            retry.py
            consumer.py

        outbound/
          http/
            http_scan_executor.py
            url_security.py

          persistence/
            sqlalchemy_scan_repository.py

  platform/
    config/
      settings.py

    database/
      sqlalchemy.py

    observability/
      logging.py

    resilience/
      backoff.py
      errors.py
```

Responsibilities:

| Layer         | Responsibility                                           |
| ------------- | -------------------------------------------------------- |
| Domain        | Scan values, findings, policies, and domain errors       |
| Application   | Scan lifecycle orchestration and dependency ports        |
| Inbound       | RabbitMQ message contract, topology, retry, and consumer |
| Outbound HTTP | HTTP execution and URL security                          |
| Persistence   | SQLAlchemy scan and finding persistence                  |
| Platform      | Shared configuration, database, logging, and resilience  |
| Bootstrap     | Dependency construction and resource ownership           |
| Entrypoints   | Process lifecycle and operational commands               |

Domain and application modules must not import:

- Pika;
- HTTPX;
- SQLAlchemy;
- environment configuration;
- process-level logging configuration.

Concrete dependencies are assembled in `bootstrap/container.py`.

## Worker execution lifecycle

The worker processes a scan using this lifecycle:

```text
RabbitMQ delivery
→ validate message
→ load and lock Scan
→ verify Monitor relationship
→ change QUEUED to RUNNING
→ execute HTTP GET
→ generate findings
→ persist result and findings
→ change Scan to SUCCEEDED or FAILED
→ ACK RabbitMQ delivery
```

The worker currently supports HTTP `GET` monitoring.

The HTTP executor performs:

- HTTP and HTTPS scheme validation;
- target address validation;
- SSRF protections;
- explicit connect, read, write, and pool timeouts;
- response status collection;
- response-time measurement.

Expected HTTP target failures are persisted as a terminal `FAILED` Scan and then acknowledged.

Examples include:

- connection timeout;
- connection refused;
- invalid target response;
- unreachable target.

These are scan results, not RabbitMQ infrastructure failures.

## Scan findings

A successful HTTP request can generate findings based on scan policies.

Current policies include:

| Condition                 | Finding             | Severity |
| ------------------------- | ------------------- | -------- |
| HTTP status `400–499`     | `HTTP_CLIENT_ERROR` | `MEDIUM` |
| HTTP status `500–599`     | `HTTP_SERVER_ERROR` | `HIGH`   |
| Response time ≥ `2000 ms` | `SLOW_RESPONSE`     | `MEDIUM` |

Findings are persisted to `ScanFinding` in the same transaction as the terminal Scan update.

A successful scan can have zero findings. For example, an HTTP `200` response below the slow-response threshold produces no finding.

## RabbitMQ topology

The scan queue topology is:

| Resource                | Value                  |
| ----------------------- | ---------------------- |
| Main exchange           | `scan`                 |
| Main routing key        | `scan.requested`       |
| Main queue              | `scan.jobs`            |
| Retry exchange          | `scan.retry`           |
| First retry queue       | `scan.jobs.retry.5s`   |
| Second retry queue      | `scan.jobs.retry.30s`  |
| Third retry queue       | `scan.jobs.retry.120s` |
| Dead-letter exchange    | `scan.dlx`             |
| Dead-letter routing key | `scan.dead`            |
| Dead-letter queue       | `scan.jobs.dead`       |

The exact producer and consumer contract is documented in `docs/queue-contract.md`.

## Worker retry behavior

Transient infrastructure failures use bounded delayed retries:

```text
initial delivery
→ retry after 5 seconds
→ retry after 30 seconds
→ retry after 120 seconds
→ dead-letter queue
```

The retry number is stored in:

```text
x-scan-retry-count
```

Retry queues are quorum queues configured with:

```text
x-overflow = reject-publish
x-dead-letter-strategy = at-least-once
```

A retry publication uses publisher confirmations.

The worker acknowledges the original delivery only after RabbitMQ accepts the retry publication. With Pika `BlockingChannel`, successful publication returns `None`. Failures are reported using exceptions such as `NackError` or `UnroutableError`.

The worker must not check the return value of `basic_publish()` for `True`.

If retry publication fails, the original delivery remains unacknowledged. Closing the connection allows RabbitMQ to redeliver it.

## Connection recovery

Worker process connection failures use exponential backoff:

```text
1s → 2s → 5s → 10s → 30s → 30s...
```

A small random jitter prevents multiple workers from reconnecting simultaneously.

Retryable connection failures include:

- PostgreSQL operational errors;
- RabbitMQ connection failures;
- lost network streams;
- recoverable broker connection closures.

Fatal configuration failures include:

- invalid RabbitMQ credentials;
- denied virtual-host access;
- incompatible queue declarations;
- invalid environment configuration.

Fatal errors stop the worker instead of causing endless retries.

## Worker shutdown

The worker handles `Ctrl+C` by leaving the consume loop and closing resources owned
by the composition container, including the HTTP client and SQLAlchemy engine. The
RabbitMQ consumer also closes its connection when its consume loop exits.

Explicit SIGTERM handling, stopping new deliveries before shutdown, and draining an
active job remain future work.

## Logging

The worker uses structured logging. Application events include:

```text
worker.started
worker.consumer_ready
worker.connection_retry
worker.interrupted
worker.failed
worker.stopped

scan.received
scan.claimed
scan.started
scan.succeeded
scan.failed
scan.retry_scheduled
scan.retry_exhausted
scan.rejected
```

Logs may include:

- `scan_id`;
- `monitor_id`;
- `status_code`;
- `response_time_ms`;
- `retry_count`;
- `delay_ms`;
- `error_type`.

Logs must never include:

- database or RabbitMQ passwords;
- authorization headers;
- cookies;
- complete response bodies;
- secrets contained in URLs.

Internal `pika`, `httpx`, and `httpcore` loggers use `WARNING` by default to keep worker output readable.

## Tests

### API tests

API integration tests use `Fastify.inject()` and do not start a TCP server.

`.env.test` must point to a dedicated test database.

Database cleanup is allowed only when:

```text
NODE_ENV=test
```

Delete child records before parent records to satisfy foreign-key constraints.

Database-backed test files run serially when they reset shared test state.

`buildApp()` defaults to `NoopScanQueue`, so ordinary API tests do not connect to RabbitMQ.

Scan API integration tests inject `FakeScanQueue` to verify:

- the exact `{ scanId, monitorId }` payload;
- successful publication;
- publication failure handling;
- persisted `FAILED` state;
- RabbitMQ resource shutdown.

### Worker unit tests

Worker unit tests must not connect to:

- PostgreSQL;
- RabbitMQ;
- external HTTP targets.

Use mocks, fakes, or local HTTP transports for application and adapter tests.

Run worker unit tests:

```bash
moon run worker:test
```

The default worker test task excludes tests marked `integration`.

### Worker integration tests

Worker integration tests require explicitly enabled local infrastructure.

Run on PowerShell:

```powershell
$env:WORKER_INFRA_TESTS = "1"
moon run worker:integration-test
Remove-Item Env:WORKER_INFRA_TESTS
```

If `RABBITMQ_URL` is not automatically loaded:

```powershell
$env:RABBITMQ_URL = ((Get-Content ..\..\.env |
    Where-Object { $_ -match "^RABBITMQ_URL=" }) -replace "^RABBITMQ_URL=", "").Trim()

$env:WORKER_INFRA_TESTS = "1"
uv run pytest -m integration -v
```

Clean up shell variables afterward:

```powershell
Remove-Item Env:WORKER_INFRA_TESTS
Remove-Item Env:RABBITMQ_URL
```

Infrastructure tests must:

- create uniquely named resources;
- avoid development queues;
- delete only their own resources;
- skip unless explicitly enabled;
- never purge `scan.jobs`;
- never require a production broker.

## Expected development workflow

Run API checks:

```bash
pnpm --filter @ontapulse/api test:db:migrate
moon run api:typecheck
pnpm --filter @ontapulse/api test
pnpm format:check
```

Run worker checks:

```bash
moon run worker:format-check
moon run worker:lint
moon run worker:test
```

Run worker infrastructure tests explicitly:

```powershell
$env:WORKER_INFRA_TESTS = "1"
moon run worker:integration-test
Remove-Item Env:WORKER_INFRA_TESTS
```

Before committing:

```bash
git diff --check
git status --short
```

## Adding an API module

Create only the layers required by the feature:

```text
<feature>.schema.ts
<feature>.repository.ts
<feature>.service.ts
<feature>.controller.ts
<feature>.openapi.ts
<feature>.routes.ts
```

Register routes under the `/api` prefix.

Add tests for:

- successful behavior;
- validation boundaries;
- missing resources;
- conflicts;
- response shape;
- resource isolation;
- authorization.

## Adding a worker module

Create a feature module under:

```text
ontapulse_worker/modules/<feature>
```

Use the following structure when the feature requires all layers:

```text
<feature>/
  domain/
  application/
    ports/
    services/
  adapters/
    inbound/
    outbound/
```

Do not create empty layers only to satisfy the directory structure.

Shared technical concerns belong under `platform` only when they are genuinely used across modules.

Examples:

| Concern                  | Location                              |
| ------------------------ | ------------------------------------- |
| Feature domain model     | `modules/<feature>/domain`            |
| Feature use case         | `modules/<feature>/application`       |
| RabbitMQ consumer        | `modules/<feature>/adapters/inbound`  |
| HTTP or database adapter | `modules/<feature>/adapters/outbound` |
| Environment settings     | `platform/config`                     |
| Logging setup            | `platform/observability`              |
| Connection resilience    | `platform/resilience`                 |
| Dependency composition   | `bootstrap`                           |
| Executable process       | `entrypoints`                         |

## Code conventions

- Prettier controls JavaScript, TypeScript, Markdown, and repository formatting.
- Ruff controls Python linting and formatting.
- Prefer one line when an expression fits within the configured width.
- Keep functions focused on one responsibility.
- Use dependency injection across application boundaries.
- Keep framework-specific code inside adapters.
- Use structured logging.
- Use stable machine-readable error codes.
- Do not expose technical exception messages to API clients.
- Do not log secrets.
- Do not manually edit generated files.
- Update documentation when contracts or topology change.

TypeScript structured logging example:

```typescript
request.log.info({ scanId }, "Scan queued");
```

Python structured logging example:

```python
logger.info("scan.started", extra={"scan_id": str(scan_id)})
```

## Queue development rules

- Application services depend on `ScanQueue`, not `amqplib`.
- Python application services depend on ports, not Pika.
- Keep scan messages limited to identifiers documented in `queue-contract.md`.
- Wait for publisher confirmation before returning API status `202`.
- Confirm retry publication before acknowledging the original delivery.
- Do not use immediate infinite requeue.
- Keep invalid messages and exhausted retries on the dead-letter path.
- Close API queue resources through Fastify `onClose`.
- Close worker queue resources during process shutdown.
- Use fake dependencies in unit and application tests.
- Do not make a live broker a default test prerequisite.
- Update the queue contract, producer, consumer, and tests together before changing message or topology definitions.

## Common failures

| Symptom                                       | Check                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| API fails environment validation              | Compare `.env` with `.env.example` and verify required variables                                              |
| Worker database connection times out          | Start PostgreSQL, inspect its host port, and verify `DATABASE_URL`                                            |
| RabbitMQ authentication returns `403`         | Verify credentials, vhost permissions, mapped port, and which process owns the port                           |
| Scan trigger returns queue unavailable        | Check broker health, credentials, `RABBITMQ_URL`, and publisher confirmation                                  |
| Scan remains `QUEUED`                         | Confirm `worker:dev` is running, inspect `scan.jobs`, and check worker connection retry logs                  |
| Queue declaration fails with error `406`      | Compare every stored queue argument with `topology.py`; RabbitMQ rejects incompatible redeclarations          |
| Retry message does not return                 | Check retry TTL, dead-letter exchange, routing key, and queue bindings                                        |
| Messages accumulate in `scan.jobs.dead`       | Inspect rejection and retry-exhaustion logs before performing an explicit redrive                             |
| Worker repeatedly reconnects                  | Check PostgreSQL/RabbitMQ availability and inspect `error_type` in `worker.connection_retry`                  |
| Integration test is skipped                   | Set `WORKER_INFRA_TESTS=1` and ensure `RABBITMQ_URL` is available to pytest                                   |
| Tests attempt to use development data         | Ensure `NODE_ENV=test` and verify that `DATABASE_URL` targets the dedicated test database                     |
| Pika `basic_publish()` returns `None`         | This is successful for `BlockingChannel`; rely on publisher-confirm exceptions instead of checking for `True` |
| Internal Pika and HTTPX logs fill the console | Set `pika`, `httpx`, and `httpcore` log levels to `WARNING`                                                   |
| Formatting check fails                        | Run the formatter, then rerun `format-check`; prefer one line when the expression fits the configured width   |

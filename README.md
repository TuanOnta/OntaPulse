# OntaPulse

OntaPulse is a website and API monitoring platform. Users organize targets into projects, create monitors, trigger scans, and inspect scan results and findings.

## Current status

| Area                                            | Status                                 |
| ----------------------------------------------- | -------------------------------------- |
| Project, Monitor, and Scan API modules          | Implemented                            |
| PostgreSQL persistence and migrations           | Implemented                            |
| RabbitMQ scan producer and dead-letter topology | Implemented                            |
| Python scan worker                              | Planned; messages are not consumed yet |
| Web interface                                   | Planned                                |

Triggering a scan currently persists it and publishes a confirmed RabbitMQ message. Until the worker is implemented, successfully published scans remain `QUEUED`.

## Stack

- TypeScript, Fastify, Zod, Prisma
- PostgreSQL for persistent domain data
- RabbitMQ for scan jobs
- Redis for cache and temporary state
- Python worker (planned/in progress) for executing scans
- pnpm and Moon for the monorepo workflow

## Repository layout

```text
apps/
  api/       Fastify API and RabbitMQ producer
  web/       Web client
  worker/    Python scan worker
packages/    Shared packages
infra/       Infrastructure configuration
docs/        Project documentation
```

## Quick start

Requirements: Docker, Node.js, pnpm, and Moon/proto as configured by the repository.

Create `.env` from `.env.example` and replace the local passwords, then run:

```bash
pnpm install
docker compose up -d
pnpm --filter @ontapulse/api exec prisma migrate dev
moon run api:dev
```

The API documentation is available at `http://localhost:<API_PORT>/docs`.

Useful local endpoints with the example ports:

- API health: `http://localhost:3000/health`
- Swagger UI: `http://localhost:3000/docs`
- RabbitMQ management UI: `http://localhost:15672`

The API connects to RabbitMQ lazily when the first scan is triggered. RabbitMQ must therefore be healthy for scan-trigger requests, even though the API can start before the first broker connection is created.

## Quality checks

```bash
moon run api:typecheck
pnpm --filter @ontapulse/api test
pnpm format:check
```

Tests use `.env.test` and a separate PostgreSQL database. They must not modify development data or require a live RabbitMQ connection.

## Documentation

- [Architecture](docs/architecture.md): components, boundaries, domain model, and request flow.
- [Development](docs/development.md): setup, commands, migrations, tests, and conventions.
- [Queue contract](docs/queue-contract.md): RabbitMQ topology, payload, delivery, and worker responsibilities.

Swagger is the source of truth for HTTP endpoints. `schema.prisma` is the source of truth for database fields. These details are intentionally not duplicated here.

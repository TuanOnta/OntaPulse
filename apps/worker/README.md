# OntaPulse worker

The worker is organized by feature. Scan behavior lives in `ontapulse_worker/modules/scans`:

- `domain`: scan values and errors, without HTTPX, Pika, or SQLAlchemy.
- `application/ports`: executor and repository contracts.
- `application/services`: scan lifecycle orchestration.
- `adapters/inbound/rabbitmq`: message validation, queue topology, and consumption.
- `adapters/outbound`: HTTP execution and SQLAlchemy persistence.

Shared configuration, database connections, messaging connections, and logging live in
`platform`. The `bootstrap/container.py` composition root connects the scan dependencies
and owns their resources. `entrypoints` contains the worker process and database check command.
Dependencies point from adapters to application and domain; platform does not import scan modules.

From the repository root:

```sh
moon run worker:dev
moon run worker:check-db
moon run worker:test
moon run worker:lint
moon run worker:format-check
```

After dependency installation, `python -m ontapulse_worker` also starts the worker from
this directory. The `ontapulse-worker-check` command only checks database readiness.

Tests mirror feature ownership under `tests/unit/modules/scans` and `tests/unit/platform`.
`tests/entrypoints` verifies startup and cleanup with fake dependencies. RabbitMQ and
repository tests currently use mocks and remain unit tests. Reserve `tests/integration`
for explicitly isolated infrastructure tests; no live infrastructure tests are included yet.

See [development](../../docs/development.md) for environment setup and
[the queue contract](../../docs/queue-contract.md) for delivery rules.

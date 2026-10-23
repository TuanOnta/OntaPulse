# OntaPulse worker

The worker is organized by feature. Check families live under `ontapulse_worker/modules`:

- `scans`: the lifecycle, the RabbitMQ consumer, and the HTTP probe (described below).
- `security_posture`: headers, cookies, CORS, redirect, TLS, and opt-in path probes. It has a pinned-address HTTP client and a TLS inspector behind ports.
- `dns_watch`: DNS baseline and diff, dangling CNAME, SPF, DKIM, and DMARC, behind a `DnsResolver` port (`dnspython`).
- `edge_detection`: a pure evaluator for CDN, WAF, and anti-bot layers (domain layer only).

The lifecycle reads the scan kind from the database and dispatches to the matching family. The check catalog is in
[security-checks](../../docs/security-checks.md).

Scan behavior lives in `ontapulse_worker/modules/scans`:

- `domain`: scan values and errors, without HTTPX, Pika, or SQLAlchemy.
- `application`: executor and repository ports (`ports.py`) and lifecycle orchestration (`scan_lifecycle.py`).
- `adapters/rabbitmq`: message validation, queue topology, and consumption.
- `adapters/http` and `adapters/sqlalchemy_scan_repository.py`: HTTP execution and persistence.

Shared configuration, database and messaging connections, logging, and resilience helpers
live in `platform`. The `bootstrap/container.py` composition root connects the scan dependencies
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

Tests mirror feature ownership under `tests/unit/modules/<feature>` and `tests/unit/platform`.
`tests/unit/entrypoints` verifies startup and cleanup with fake dependencies. RabbitMQ and
repository unit tests use mocks. `tests/integration` holds the isolated infrastructure tests;
they are skipped unless `WORKER_INFRA_TESTS=1` is set.

See [development](../../docs/development.md) for environment setup and
[the queue contract](../../docs/queue-contract.md) for delivery rules.

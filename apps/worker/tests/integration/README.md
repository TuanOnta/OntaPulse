# Integration tests

Infrastructure tests live under `modules/<feature>/` and mirror the source layout.
They use real PostgreSQL and RabbitMQ with isolated test resources, are marked
`infrastructure`, and are skipped unless `WORKER_INFRA_TESTS=1` is set. Run them with
`moon run worker:integration-test`; the default worker suite must not require live services.
Mock-based consumer and repository tests live under `tests/unit/modules/scans/adapters`.

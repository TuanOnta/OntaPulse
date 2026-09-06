# Integration tests

Place future infrastructure tests under `modules/<feature>/`. Current consumer and
repository tests use mocks and live under `tests/unit/modules/scans/adapters`.
Real PostgreSQL or RabbitMQ tests must use isolated test resources and be explicitly
marked and selected; the default worker suite must not require live services.

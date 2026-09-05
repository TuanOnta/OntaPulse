# Scan queue contract

This document is the shared contract between the TypeScript API producer and Python worker consumer.

## Implementation status

The API producer is implemented. It declares the topology, publishes persistent messages through a confirm channel, handles backpressure, and closes the broker connection during Fastify shutdown. The Python worker implements matching topology declaration, strict message parsing, delivery settlement, and the idempotent `QUEUED` to terminal-state database lifecycle around an injected executor. It is not activated as a long-running process until HTTP checks and bounded retry are implemented; the remaining consumer rules below are normative requirements for that milestone.

## RabbitMQ topology

| Resource                | Value            |
| ----------------------- | ---------------- |
| Exchange                | `scan`           |
| Exchange type           | `direct`         |
| Routing key             | `scan.requested` |
| Queue                   | `scan.jobs`      |
| Dead-letter exchange    | `scan.dlx`       |
| Dead-letter routing key | `scan.dead`      |
| Dead-letter queue       | `scan.jobs.dead` |

Exchanges and queues are durable. Published scan messages are persistent.

The producer declares this topology idempotently on its first enqueue. Existing resources must have compatible types, durability, bindings, and queue arguments; RabbitMQ rejects conflicting declarations.

## Message

```json
{
  "scanId": "f7ad663f-bde8-4dc9-8281-5594d6c73c28",
  "monitorId": "3edca2bb-c92c-4ac8-a5ed-75630416f604"
}
```

Both fields are required UUID strings. `messageId` must equal `scanId`, `contentType` must be `application/json`, and message type is `scan.requested`.

The producer also sets UTF-8 content encoding and a publication timestamp. Consumers must not depend on the timestamp for business ordering or idempotency.

Do not copy Monitor configuration into the message. The worker loads current data from PostgreSQL using the identifiers, preventing stale configuration from becoming authoritative.

## Producer responsibility

1. Confirm that the Monitor exists.
2. Create a Scan with status `QUEUED`.
3. Publish the message using a confirm channel.
4. Wait for broker confirmation.
5. If publishing fails, mark the Scan `FAILED` and return `503 SCAN_QUEUE_UNAVAILABLE`.

The persisted failure uses the safe message `Scan queue is unavailable` and sets `finishedAt`. The technical error remains attached as the application error cause for structured server logging and must not be returned to the client.

The API may be running without an open RabbitMQ connection because the producer connects lazily. Fastify shutdown closes both the confirm channel and its connection when they have been created.

The database write and broker publish are not atomic. Publisher confirms establish that RabbitMQ accepted a publication, but they do not make the preceding database insert part of the same transaction. A connection failure can also be ambiguous: the broker may have accepted the message even though the producer did not receive confirmation. A transactional outbox is the planned reliability improvement if broker failure recovery becomes insufficient.

## Consumer responsibility

1. Parse and validate the payload.
2. Load the Scan and Monitor from PostgreSQL.
3. Treat an already completed Scan as idempotently handled.
4. Change `QUEUED` to `RUNNING` and set `startedAt`.
5. Execute the HTTP checks with explicit timeouts and safe URL handling.
6. Save Scan fields and findings in a database transaction.
7. Set `SUCCEEDED` or `FAILED` and `finishedAt`.
8. ACK only after the database transaction succeeds.

## Delivery and failure rules

RabbitMQ provides at-least-once delivery, so duplicate delivery is expected and must be safe.

- ACK after successful persistence.
- For a transient failure, retry with a bounded policy; do not requeue forever in a tight loop.
- For invalid payloads, missing permanent data, or exhausted retries, reject without requeue so the message reaches `scan.jobs.dead`.
- Never log credentials, authorization headers, cookies, or response bodies that may contain secrets.

The current topology provides a dead-letter path but does not itself schedule delayed retries. Any retry queue or delay mechanism must be documented here before implementation.

## Testing boundary

Application and integration tests use `NoopScanQueue` or `FakeScanQueue`; they must not connect to RabbitMQ. A real-broker test must be explicitly classified as an infrastructure test, use isolated broker resources, and clean up only those resources.

The Scan API integration suite must prove:

- the published job contains exactly `scanId` and `monitorId`;
- a successful enqueue returns the persisted `QUEUED` Scan;
- an enqueue failure returns `503 SCAN_QUEUE_UNAVAILABLE`;
- the failed Scan is persisted with `FAILED`, a safe error message, and `finishedAt`;
- application shutdown calls `ScanQueue.close()`.

## Operational inspection

With the example local configuration, open `http://localhost:15672` and inspect `scan.jobs` and `scan.jobs.dead`. Queue depth can confirm whether messages are being published, but a growing `scan.jobs` count is expected until a worker is running. Never expose the management UI or its credentials publicly.

# Scan queue contract

This document is the shared contract between the TypeScript API producer and Python worker consumer.

## Implementation status

The TypeScript API producer and Python worker consumer are implemented and
active.

The producer publishes persistent messages through a confirm channel. The worker
performs strict message validation, idempotent database claiming, HTTP execution,
finding persistence, bounded delayed retries, and explicit delivery settlement.

## RabbitMQ topology

| Resource                | Value                  |
| ----------------------- | ---------------------- |
| Main exchange           | `scan`                 |
| Main exchange type      | `direct`               |
| Main routing key        | `scan.requested`       |
| Main queue              | `scan.jobs`            |
| Retry exchange          | `scan.retry`           |
| First retry queue       | `scan.jobs.retry.5s`   |
| Second retry queue      | `scan.jobs.retry.30s`  |
| Third retry queue       | `scan.jobs.retry.120s` |
| Dead-letter exchange    | `scan.dlx`             |
| Dead-letter routing key | `scan.dead`            |
| Dead-letter queue       | `scan.jobs.dead`       |

Exchanges and queues are durable. Published scan and retry messages are
persistent.

Retry queues are quorum queues configured with `at-least-once` dead-lettering
and `reject-publish` overflow behavior.

### Retry schedule

| Retry number | Routing key    | Queue                  | Delay |
| ------------ | -------------- | ---------------------- | ----- |
| 1            | `scan.retry.1` | `scan.jobs.retry.5s`   | 5s    |
| 2            | `scan.retry.2` | `scan.jobs.retry.30s`  | 30s   |
| 3            | `scan.retry.3` | `scan.jobs.retry.120s` | 120s  |

The worker stores the retry number in the `x-scan-retry-count` message header.

Each retry queue applies a fixed message TTL and dead-letters expired messages
back to the `scan` exchange using the `scan.requested` routing key.

After the third retry fails, the worker rejects the delivery without requeueing
it. RabbitMQ then routes the message to `scan.jobs.dead`.

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

RabbitMQ provides at-least-once delivery, so duplicate delivery is expected and
must be safe.

| Failure type                   | Worker behavior                                    |
| ------------------------------ | -------------------------------------------------- |
| Successful scan                | Persist result and findings, then ACK              |
| Target HTTP failure            | Persist Scan as `FAILED`, then ACK                 |
| Invalid message                | Reject without requeue                             |
| Missing permanent data         | Reject without requeue                             |
| Transient infrastructure error | Publish to the next retry queue, confirm, then ACK |
| Exhausted retries              | Reject without requeue                             |
| Retry publication failure      | Leave the original delivery unacknowledged         |

The worker must confirm a retry publication before acknowledging the original
delivery. If retry publication fails, closing the connection allows RabbitMQ to
redeliver the unacknowledged original message.

HTTP target failures such as timeouts, connection failures, or invalid target
responses are scan results, not worker infrastructure failures. They mark the
Scan as `FAILED` and do not trigger RabbitMQ retry.

Never log credentials, authorization headers, cookies, or response bodies that
may contain secrets.

### Bounded retry

There are four execution attempts: the initial delivery followed by retries after 5,
30, and 120 seconds. `x-scan-retry-count` is an AMQP header, not a JSON payload field.
It is absent (equivalent to zero) on API publications and must be an integer from zero
through three. Invalid values are permanent message failures.

Both producer and consumer declare the durable direct exchange `scan.retry` and three
durable quorum queues: `scan.jobs.retry.5s`, `scan.jobs.retry.30s`, and
`scan.jobs.retry.120s`. Their routing keys are `scan.retry.1`, `scan.retry.2`, and
`scan.retry.3`; queue TTLs are 5000, 30000, and 120000 milliseconds. Each queue
dead-letters to `scan` / `scan.requested`, with `x-dead-letter-strategy=at-least-once`
and `x-overflow=reject-publish` so expired retries are retained until their transfer
is confirmed. This requires RabbitMQ quorum queue support (the local RabbitMQ 4 image
supports it). Existing main and dead-letter queues retain their definitions.

On an internal failure, the consumer publishes the unchanged body with an incremented
retry header, persistent delivery, mandatory routing, and publisher confirmation,
then ACKs the original. An ambiguous confirmation can duplicate delivery, so terminal
scans remain idempotent. Failed publication leaves the original unacknowledged for
redelivery after the consumer connection is restored. After the fourth failed execution, reject without requeue to
`scan.jobs.dead`. Invalid payloads and permanent job errors go directly to that queue.
An expected GET execution error is persisted as `FAILED` and ACKed, without retry.

The final rejection uses the existing main queue's dead-letter mechanism; unlike the
new quorum retry queues, its classic queue dead-letter transfer is not replicated or
publisher-confirmed. Do not delete existing queues to change their type.

## Testing boundary

Application and integration tests use `NoopScanQueue` or `FakeScanQueue`; they must not connect to RabbitMQ. A real-broker test must be explicitly classified as an infrastructure test, use isolated broker resources, and clean up only those resources.

The Scan API integration suite must prove:

- the published job contains exactly `scanId` and `monitorId`;
- a successful enqueue returns the persisted `QUEUED` Scan;
- an enqueue failure returns `503 SCAN_QUEUE_UNAVAILABLE`;
- the failed Scan is persisted with `FAILED`, a safe error message, and `finishedAt`;
- application shutdown calls `ScanQueue.close()`.

## Operational inspection

Open the RabbitMQ management UI using the configured
`RABBITMQ_MANAGEMENT_PORT`.

The following queues should exist while the worker is active:

```text
scan.jobs
scan.jobs.retry.5s
scan.jobs.retry.30s
scan.jobs.retry.120s
scan.jobs.dead
```

A growing scan.jobs count indicates that consumers are unavailable or slower
than producers. A growing retry queue indicates transient infrastructure
failures. Messages in scan.jobs.dead require investigation or an explicit
redrive procedure.

Never expose the management UI or its credentials publicly.

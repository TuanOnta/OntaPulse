"""RabbitMQ topology for scan jobs."""

from pika.adapters.blocking_connection import BlockingChannel

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.retry import RETRY_STEPS

SCAN_EXCHANGE = "scan"
SCAN_QUEUE = "scan.jobs"
SCAN_ROUTING_KEY = "scan.requested"

SCAN_RETRY_EXCHANGE = "scan.retry"

SCAN_DEAD_LETTER_EXCHANGE = "scan.dlx"
SCAN_DEAD_LETTER_QUEUE = "scan.jobs.dead"
SCAN_DEAD_LETTER_ROUTING_KEY = "scan.dead"


def declare_scan_topology(channel: BlockingChannel) -> None:
    channel.exchange_declare(exchange=SCAN_EXCHANGE, exchange_type="direct", durable=True)
    channel.exchange_declare(exchange=SCAN_RETRY_EXCHANGE, exchange_type="direct", durable=True)
    channel.exchange_declare(
        exchange=SCAN_DEAD_LETTER_EXCHANGE,
        exchange_type="direct",
        durable=True,
    )

    channel.queue_declare(queue=SCAN_DEAD_LETTER_QUEUE, durable=True)
    channel.queue_bind(
        queue=SCAN_DEAD_LETTER_QUEUE,
        exchange=SCAN_DEAD_LETTER_EXCHANGE,
        routing_key=SCAN_DEAD_LETTER_ROUTING_KEY,
    )

    channel.queue_declare(
        queue=SCAN_QUEUE,
        durable=True,
        arguments={
            "x-dead-letter-exchange": SCAN_DEAD_LETTER_EXCHANGE,
            "x-dead-letter-routing-key": SCAN_DEAD_LETTER_ROUTING_KEY,
        },
    )
    channel.queue_bind(queue=SCAN_QUEUE, exchange=SCAN_EXCHANGE, routing_key=SCAN_ROUTING_KEY)

    for step in RETRY_STEPS:
        channel.queue_declare(
            queue=step.queue,
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-message-ttl": step.delay_ms,
                "x-overflow": "reject-publish",
                "x-dead-letter-strategy": "at-least-once",
                "x-dead-letter-exchange": SCAN_EXCHANGE,
                "x-dead-letter-routing-key": SCAN_ROUTING_KEY,
            },
        )
        channel.queue_bind(
            queue=step.queue,
            exchange=SCAN_RETRY_EXCHANGE,
            routing_key=step.routing_key,
        )

from pika.adapters.blocking_connection import BlockingChannel

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.retry import (
    RETRY_DELAYS_SECONDS,
    RETRY_EXCHANGE,
)

SCAN_EXCHANGE = "scan"
SCAN_QUEUE = "scan.jobs"
SCAN_ROUTING_KEY = "scan.requested"
SCAN_DEAD_LETTER_EXCHANGE = "scan.dlx"
SCAN_DEAD_LETTER_QUEUE = "scan.jobs.dead"
SCAN_DEAD_LETTER_ROUTING_KEY = "scan.dead"


def declare_scan_topology(channel: BlockingChannel) -> None:
    channel.exchange_declare(exchange=SCAN_EXCHANGE, exchange_type="direct", durable=True)
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
    channel.exchange_declare(exchange=RETRY_EXCHANGE, exchange_type="direct", durable=True)
    for delay in RETRY_DELAYS_SECONDS:
        queue = f"scan.jobs.retry.{delay}s"
        channel.queue_declare(
            queue=queue,
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-message-ttl": delay * 1000,
                "x-dead-letter-exchange": SCAN_EXCHANGE,
                "x-dead-letter-routing-key": SCAN_ROUTING_KEY,
                "x-dead-letter-strategy": "at-least-once",
                "x-overflow": "reject-publish",
            },
        )
        channel.queue_bind(queue=queue, exchange=RETRY_EXCHANGE, routing_key=f"scan.retry.{delay}s")

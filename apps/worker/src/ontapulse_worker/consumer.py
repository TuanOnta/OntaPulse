import json
from typing import Protocol

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

from ontapulse_worker.scan_job import (
    InvalidScanMessage,
    PermanentScanJobError,
    ScanJobHandler,
    parse_scan_job,
)

SCAN_EXCHANGE = "scan"
SCAN_QUEUE = "scan.jobs"
SCAN_ROUTING_KEY = "scan.requested"
SCAN_DEAD_LETTER_EXCHANGE = "scan.dlx"
SCAN_DEAD_LETTER_QUEUE = "scan.jobs.dead"
SCAN_DEAD_LETTER_ROUTING_KEY = "scan.dead"


class DeliveryChannel(Protocol):
    def basic_ack(self, delivery_tag: int) -> None: ...

    def basic_reject(self, delivery_tag: int, requeue: bool) -> None: ...


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


def process_delivery(
    channel: DeliveryChannel,
    delivery_tag: int,
    properties: BasicProperties,
    body: bytes,
    handler: ScanJobHandler,
) -> None:
    try:
        job = parse_scan_job(body, properties)
        handler(job)
    except (InvalidScanMessage, PermanentScanJobError):
        channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        return

    channel.basic_ack(delivery_tag=delivery_tag)


class RabbitMqScanConsumer:
    def __init__(self, url: str, handler: ScanJobHandler) -> None:
        self._url = url
        self._handler = handler

    def run(self) -> None:
        connection = pika.BlockingConnection(pika.URLParameters(self._url))

        try:
            channel = connection.channel()
            declare_scan_topology(channel)
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=SCAN_QUEUE, on_message_callback=self._on_message)
            print(json.dumps({"level": "info", "event": "worker.consumer_ready"}))
            channel.start_consuming()
        finally:
            if connection.is_open:
                connection.close()

    def _on_message(
        self,
        channel: BlockingChannel,
        method: Basic.Deliver,
        properties: BasicProperties,
        body: bytes,
    ) -> None:
        process_delivery(channel, method.delivery_tag, properties, body, self._handler)

"""RabbitMQ consumer for scan jobs."""

import logging
from collections.abc import Callable
from typing import Protocol

import pika
from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.contract import (
    InvalidScanMessage,
    parse_scan_job,
)
from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.retry import (
    create_retry_properties,
    get_next_retry,
    get_retry_count,
)
from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.topology import (
    SCAN_QUEUE,
    SCAN_RETRY_EXCHANGE,
    declare_scan_topology,
)
from ontapulse_worker.modules.scans.domain.errors import PermanentScanJobError
from ontapulse_worker.modules.scans.domain.models import ScanJob

logger = logging.getLogger(__name__)

ScanJobHandler = Callable[[ScanJob], None]


class DeliveryChannel(Protocol):
    def basic_ack(self, delivery_tag: int) -> None: ...

    def basic_reject(self, delivery_tag: int, requeue: bool) -> None: ...

    def basic_publish(
        self,
        exchange: str,
        routing_key: str,
        body: bytes,
        properties: BasicProperties,
        mandatory: bool,
    ) -> bool: ...


class RetryPublishError(RuntimeError):
    """Raised when RabbitMQ does not confirm a retry publication."""


def process_delivery(
    channel: DeliveryChannel,
    delivery_tag: int,
    properties: BasicProperties,
    body: bytes,
    handler: ScanJobHandler,
) -> None:
    job: ScanJob | None = None

    try:
        get_retry_count(properties)
        job = parse_scan_job(body, properties)
        logger.info(
            "scan.received",
            extra={
                "scan_id": str(job.scan_id),
                "monitor_id": str(job.monitor_id),
                "status_code": None,
                "response_time_ms": None,
            },
        )
        handler(job)
    except (InvalidScanMessage, PermanentScanJobError) as error:
        logger.warning(
            "scan.rejected",
            extra={
                "scan_id": str(job.scan_id) if job else None,
                "monitor_id": str(job.monitor_id) if job else None,
                "status_code": None,
                "response_time_ms": None,
                "error_type": type(error).__name__,
            },
        )
        channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
    except Exception as error:
        retry_or_reject(channel, delivery_tag, properties, body, job, error)
    else:
        channel.basic_ack(delivery_tag=delivery_tag)


def retry_or_reject(
    channel: DeliveryChannel,
    delivery_tag: int,
    properties: BasicProperties,
    body: bytes,
    job: ScanJob | None,
    error: Exception,
) -> None:
    step = get_next_retry(properties)
    context = {
        "scan_id": str(job.scan_id) if job else None,
        "monitor_id": str(job.monitor_id) if job else None,
        "status_code": None,
        "response_time_ms": None,
        "error_type": type(error).__name__,
    }

    if step is None:
        logger.error("scan.retry_exhausted", extra=context)
        channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        return

    confirmed = channel.basic_publish(
        exchange=SCAN_RETRY_EXCHANGE,
        routing_key=step.routing_key,
        body=body,
        properties=create_retry_properties(properties, step.number),
        mandatory=True,
    )

    if confirmed is not True:
        raise RetryPublishError("RabbitMQ did not confirm retry publication")

    logger.warning(
        "scan.retry_scheduled",
        extra={**context, "retry_count": step.number, "delay_ms": step.delay_ms},
    )
    channel.basic_ack(delivery_tag=delivery_tag)


class RabbitMqScanConsumer:
    def __init__(self, url: str, handler: ScanJobHandler) -> None:
        self._url = url
        self._handler = handler

    def run(self, on_ready: Callable[[], None] | None = None) -> None:
        connection = pika.BlockingConnection(pika.URLParameters(self._url))

        try:
            channel = connection.channel()
            declare_scan_topology(channel)
            channel.confirm_delivery()
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=SCAN_QUEUE, on_message_callback=self._on_message)
            logger.info("worker.consumer_ready")

            if on_ready:
                on_ready()

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

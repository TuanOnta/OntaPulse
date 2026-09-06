import logging
from collections.abc import Callable
from typing import Protocol

from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic, BasicProperties

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.contract import (
    InvalidScanMessage,
    parse_scan_job,
)
from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.retry import (
    publish_retry,
    retry_count,
)
from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.topology import (
    SCAN_QUEUE,
    declare_scan_topology,
)
from ontapulse_worker.modules.scans.domain.errors import PermanentScanJobError
from ontapulse_worker.modules.scans.domain.models import ScanJob
from ontapulse_worker.platform.messaging.rabbitmq import create_connection
from ontapulse_worker.platform.observability.logging import log_event

logger = logging.getLogger(__name__)

ScanJobHandler = Callable[[ScanJob], None]


class DeliveryChannel(Protocol):
    def basic_ack(self, delivery_tag: int) -> None: ...

    def basic_reject(self, delivery_tag: int, requeue: bool) -> None: ...


def process_delivery(
    channel: DeliveryChannel,
    delivery_tag: int,
    properties: BasicProperties,
    body: bytes,
    handler: ScanJobHandler,
) -> None:
    fields = {"scan_id": None, "monitor_id": None, "status_code": None, "response_time_ms": None}
    try:
        job = parse_scan_job(body, properties)
        fields.update(scan_id=str(job.scan_id), monitor_id=str(job.monitor_id))
        retry_count(properties)
        logger.info("scan.received", extra=fields)
        handler(job)
    except (InvalidScanMessage, PermanentScanJobError):
        logger.warning("scan.rejected", extra={**fields, "reason": "permanent_failure"})
        channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        return
    except Exception:
        if publish_retry(channel, body, properties):
            logger.warning(
                "scan.retry_scheduled", extra={**fields, "retry_count": retry_count(properties) + 1}
            )
            channel.basic_ack(delivery_tag=delivery_tag)
        else:
            logger.error("scan.rejected", extra={**fields, "reason": "retries_exhausted"})
            channel.basic_reject(delivery_tag=delivery_tag, requeue=False)
        return

    channel.basic_ack(delivery_tag=delivery_tag)


class RabbitMqScanConsumer:
    def __init__(self, url: str, handler: ScanJobHandler) -> None:
        self._url = url
        self._handler = handler

    def run(self) -> None:
        connection = create_connection(self._url)

        try:
            channel = connection.channel()
            declare_scan_topology(channel)
            channel.confirm_delivery()
            channel.basic_qos(prefetch_count=1)
            channel.basic_consume(queue=SCAN_QUEUE, on_message_callback=self._on_message)
            log_event("info", "worker.consumer_ready")
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

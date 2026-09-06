"""Confirmed publication to bounded, broker-delayed retry queues."""

from copy import copy

from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import BasicProperties

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.contract import InvalidScanMessage

RETRY_DELAYS_SECONDS = (5, 30, 120)
RETRY_EXCHANGE = "scan.retry"
RETRY_COUNT_HEADER = "x-scan-retry-count"


def retry_count(properties: BasicProperties) -> int:
    count = (properties.headers or {}).get(RETRY_COUNT_HEADER, 0)
    if type(count) is not int or not 0 <= count <= len(RETRY_DELAYS_SECONDS):
        raise InvalidScanMessage("invalid retry count")
    return count


def publish_retry(channel: BlockingChannel, body: bytes, properties: BasicProperties) -> bool:
    count = retry_count(properties)
    if count == len(RETRY_DELAYS_SECONDS):
        return False
    retry_properties = copy(properties)
    retry_properties.headers = {**(properties.headers or {}), RETRY_COUNT_HEADER: count + 1}
    retry_properties.delivery_mode = 2
    retry_properties.expiration = None
    channel.basic_publish(
        exchange=RETRY_EXCHANGE,
        routing_key=f"scan.retry.{RETRY_DELAYS_SECONDS[count]}s",
        body=body,
        properties=retry_properties,
        mandatory=True,
    )
    return True

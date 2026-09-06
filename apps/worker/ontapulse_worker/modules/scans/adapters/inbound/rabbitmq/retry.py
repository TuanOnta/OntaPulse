"""Bounded retry policy for scan deliveries."""

from dataclasses import dataclass

from pika.spec import BasicProperties

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.contract import InvalidScanMessage

RETRY_COUNT_HEADER = "x-scan-retry-count"


@dataclass(frozen=True)
class RetryStep:
    number: int
    queue: str
    routing_key: str
    delay_ms: int


RETRY_STEPS = (
    RetryStep(1, "scan.jobs.retry.5s", "scan.retry.1", 5_000),
    RetryStep(2, "scan.jobs.retry.30s", "scan.retry.2", 30_000),
    RetryStep(3, "scan.jobs.retry.120s", "scan.retry.3", 120_000),
)


def get_retry_count(properties: BasicProperties) -> int:
    value = (properties.headers or {}).get(RETRY_COUNT_HEADER, 0)

    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= len(RETRY_STEPS):
        raise InvalidScanMessage("invalid retry count")

    return value


def get_next_retry(properties: BasicProperties) -> RetryStep | None:
    retry_count = get_retry_count(properties)
    return RETRY_STEPS[retry_count] if retry_count < len(RETRY_STEPS) else None


def create_retry_properties(properties: BasicProperties, retry_number: int) -> BasicProperties:
    headers = dict(properties.headers or {})
    headers[RETRY_COUNT_HEADER] = retry_number

    return BasicProperties(
        content_type=properties.content_type,
        content_encoding=properties.content_encoding,
        headers=headers,
        delivery_mode=2,
        message_id=properties.message_id,
        timestamp=properties.timestamp,
        type=properties.type,
        app_id=properties.app_id,
    )

from unittest.mock import Mock, call

import pytest
from pika.spec import BasicProperties

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.consumer import process_delivery
from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.topology import declare_scan_topology
from ontapulse_worker.modules.scans.domain.errors import PermanentScanJobError

SCAN_ID = "f7ad663f-bde8-4dc9-8281-5594d6c73c28"
MONITOR_ID = "3edca2bb-c92c-4ac8-a5ed-75630416f604"
VALID_BODY = f'{{"scanId":"{SCAN_ID}","monitorId":"{MONITOR_ID}"}}'.encode()


def valid_properties() -> BasicProperties:
    return BasicProperties(
        content_type="application/json",
        message_id=SCAN_ID,
        type="scan.requested",
    )


def test_declare_scan_topology_matches_the_producer() -> None:
    channel = Mock()

    declare_scan_topology(channel)

    assert channel.exchange_declare.call_args_list[:2] == [
        call(exchange="scan", exchange_type="direct", durable=True),
        call(exchange="scan.dlx", exchange_type="direct", durable=True),
    ]
    assert channel.queue_declare.call_args_list[:2] == [
        call(queue="scan.jobs.dead", durable=True),
        call(
            queue="scan.jobs",
            durable=True,
            arguments={
                "x-dead-letter-exchange": "scan.dlx",
                "x-dead-letter-routing-key": "scan.dead",
            },
        ),
    ]
    assert channel.queue_bind.call_args_list[:2] == [
        call(queue="scan.jobs.dead", exchange="scan.dlx", routing_key="scan.dead"),
        call(queue="scan.jobs", exchange="scan", routing_key="scan.requested"),
    ]


def test_process_delivery_acknowledges_only_after_handler_succeeds(caplog) -> None:
    events: list[str] = []
    channel = Mock()
    channel.basic_ack.side_effect = lambda **_: events.append("ack")

    with caplog.at_level("INFO"):
        process_delivery(
            channel,
            7,
            valid_properties(),
            VALID_BODY,
            lambda _: events.append("handled"),
        )

    assert events == ["handled", "ack"]
    channel.basic_ack.assert_called_once_with(delivery_tag=7)
    channel.basic_reject.assert_not_called()
    received = next(record for record in caplog.records if record.message == "scan.received")
    assert received.scan_id == SCAN_ID
    assert received.monitor_id == MONITOR_ID
    assert received.status_code is None
    assert received.response_time_ms is None


def test_process_delivery_dead_letters_an_invalid_message() -> None:
    channel = Mock()
    handler = Mock()

    process_delivery(channel, 8, valid_properties(), b"invalid", handler)

    handler.assert_not_called()
    channel.basic_reject.assert_called_once_with(delivery_tag=8, requeue=False)
    channel.basic_ack.assert_not_called()


def test_process_delivery_dead_letters_a_permanent_failure(caplog) -> None:
    channel = Mock()
    handler = Mock(side_effect=PermanentScanJobError("scan does not exist"))

    with caplog.at_level("INFO"):
        process_delivery(channel, 9, valid_properties(), VALID_BODY, handler)

    channel.basic_reject.assert_called_once_with(delivery_tag=9, requeue=False)
    channel.basic_ack.assert_not_called()
    rejected = next(record for record in caplog.records if record.message == "scan.rejected")
    assert rejected.scan_id == SCAN_ID
    assert rejected.monitor_id == MONITOR_ID


def test_process_delivery_confirms_retry_before_ack() -> None:
    events = []
    channel = Mock()
    channel.basic_publish.side_effect = lambda **_: events.append("confirmed")
    channel.basic_ack.side_effect = lambda **_: events.append("ack")
    handler = Mock(side_effect=RuntimeError("temporary database failure"))
    process_delivery(channel, 10, valid_properties(), VALID_BODY, handler)
    assert events == ["confirmed", "ack"]
    channel.basic_reject.assert_not_called()


def test_retry_publish_failure_leaves_original_unacknowledged():
    channel = Mock()
    channel.basic_publish.side_effect = RuntimeError("broker unavailable")
    with pytest.raises(RuntimeError, match="broker unavailable"):
        process_delivery(
            channel, 10, valid_properties(), VALID_BODY, Mock(side_effect=RuntimeError())
        )
    channel.basic_ack.assert_not_called()
    channel.basic_reject.assert_not_called()


@pytest.mark.parametrize("count", [True, -1, 4, "1"])
def test_invalid_retry_header_is_permanent(count):
    channel, handler = Mock(), Mock()
    properties = valid_properties()
    properties.headers = {"x-scan-retry-count": count}
    process_delivery(channel, 10, properties, VALID_BODY, handler)
    handler.assert_not_called()
    channel.basic_reject.assert_called_once_with(delivery_tag=10, requeue=False)


@pytest.mark.parametrize("count,delay", [(0, 5), (1, 30), (2, 120)])
def test_retry_delays_and_header_are_bounded(count, delay):
    channel = Mock()
    properties = valid_properties()
    properties.headers = {"x-scan-retry-count": count}
    process_delivery(channel, 10, properties, VALID_BODY, Mock(side_effect=RuntimeError()))
    published = channel.basic_publish.call_args.kwargs
    assert published["routing_key"] == f"scan.retry.{delay}s"
    assert published["properties"].headers["x-scan-retry-count"] == count + 1
    assert published["body"] == VALID_BODY
    assert published["mandatory"] is True
    assert published["properties"].delivery_mode == 2
    assert properties.headers["x-scan-retry-count"] == count


def test_exhausted_retry_goes_to_dlq():
    channel = Mock()
    properties = valid_properties()
    properties.headers = {"x-scan-retry-count": 3}
    process_delivery(channel, 10, properties, VALID_BODY, Mock(side_effect=RuntimeError()))
    channel.basic_publish.assert_not_called()
    channel.basic_ack.assert_not_called()
    channel.basic_reject.assert_called_once_with(delivery_tag=10, requeue=False)


def test_retry_queues_use_confirmed_dead_lettering_and_per_queue_ttl():
    channel = Mock()
    declare_scan_topology(channel)
    for declaration, delay in zip(
        channel.queue_declare.call_args_list[2:], [5, 30, 120], strict=True
    ):
        args = declaration.kwargs
        assert args["queue"] == f"scan.jobs.retry.{delay}s"
        assert args["arguments"] == {
            "x-queue-type": "quorum",
            "x-message-ttl": delay * 1000,
            "x-dead-letter-exchange": "scan",
            "x-dead-letter-routing-key": "scan.requested",
            "x-dead-letter-strategy": "at-least-once",
            "x-overflow": "reject-publish",
        }

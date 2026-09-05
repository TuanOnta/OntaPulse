from unittest.mock import Mock, call

import pytest
from pika.spec import BasicProperties

from ontapulse_worker.domain.scan import PermanentScanJobError
from ontapulse_worker.infrastructure.rabbitmq import declare_scan_topology, process_delivery

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

    assert channel.exchange_declare.call_args_list == [
        call(exchange="scan", exchange_type="direct", durable=True),
        call(exchange="scan.dlx", exchange_type="direct", durable=True),
    ]
    assert channel.queue_declare.call_args_list == [
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
    assert channel.queue_bind.call_args_list == [
        call(queue="scan.jobs.dead", exchange="scan.dlx", routing_key="scan.dead"),
        call(queue="scan.jobs", exchange="scan", routing_key="scan.requested"),
    ]


def test_process_delivery_acknowledges_only_after_handler_succeeds() -> None:
    events: list[str] = []
    channel = Mock()
    channel.basic_ack.side_effect = lambda **_: events.append("ack")

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


def test_process_delivery_dead_letters_an_invalid_message() -> None:
    channel = Mock()
    handler = Mock()

    process_delivery(channel, 8, valid_properties(), b"invalid", handler)

    handler.assert_not_called()
    channel.basic_reject.assert_called_once_with(delivery_tag=8, requeue=False)
    channel.basic_ack.assert_not_called()


def test_process_delivery_dead_letters_a_permanent_failure() -> None:
    channel = Mock()
    handler = Mock(side_effect=PermanentScanJobError("scan does not exist"))

    process_delivery(channel, 9, valid_properties(), VALID_BODY, handler)

    channel.basic_reject.assert_called_once_with(delivery_tag=9, requeue=False)
    channel.basic_ack.assert_not_called()


def test_process_delivery_leaves_transient_failures_unacknowledged() -> None:
    channel = Mock()
    handler = Mock(side_effect=RuntimeError("temporary database failure"))

    with pytest.raises(RuntimeError, match="temporary database failure"):
        process_delivery(channel, 10, valid_properties(), VALID_BODY, handler)

    channel.basic_ack.assert_not_called()
    channel.basic_reject.assert_not_called()

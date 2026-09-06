"""Integration tests for RabbitMQ delayed retry topology."""

import os
from time import monotonic, sleep
from uuid import uuid4

import pika
import pytest


@pytest.mark.integration
def test_expired_retry_message_returns_to_main_queue() -> None:
    rabbitmq_url = os.getenv("RABBITMQ_URL")

    if not rabbitmq_url:
        pytest.skip("RABBITMQ_URL is not configured")

    prefix = f"test.{uuid4().hex}"
    main_exchange = f"{prefix}.scan"
    retry_exchange = f"{prefix}.scan.retry"
    main_queue = f"{prefix}.scan.jobs"
    retry_queue = f"{prefix}.scan.jobs.retry"
    main_routing_key = "scan.requested"
    retry_routing_key = "scan.retry.1"

    connection = pika.BlockingConnection(pika.URLParameters(rabbitmq_url))
    channel = connection.channel()

    try:
        channel.exchange_declare(exchange=main_exchange, exchange_type="direct", durable=True)
        channel.exchange_declare(exchange=retry_exchange, exchange_type="direct", durable=True)

        channel.queue_declare(
            queue=main_queue,
            durable=True,
            arguments={"x-queue-type": "quorum"},
        )
        channel.queue_bind(
            queue=main_queue,
            exchange=main_exchange,
            routing_key=main_routing_key,
        )

        channel.queue_declare(
            queue=retry_queue,
            durable=True,
            arguments={
                "x-queue-type": "quorum",
                "x-message-ttl": 250,
                "x-overflow": "reject-publish",
                "x-dead-letter-strategy": "at-least-once",
                "x-dead-letter-exchange": main_exchange,
                "x-dead-letter-routing-key": main_routing_key,
            },
        )
        channel.queue_bind(
            queue=retry_queue,
            exchange=retry_exchange,
            routing_key=retry_routing_key,
        )

        channel.confirm_delivery()
        channel.basic_publish(
            exchange=retry_exchange,
            routing_key=retry_routing_key,
            body=b'{"test":true}',
            properties=pika.BasicProperties(
                content_type="application/json",
                delivery_mode=2,
            ),
            mandatory=True,
        )

        deadline = monotonic() + 5
        method = None
        body = None

        while monotonic() < deadline:
            method, _, body = channel.basic_get(queue=main_queue, auto_ack=False)

            if method:
                break

            sleep(0.05)

        assert method is not None
        assert body == b'{"test":true}'
        channel.basic_ack(method.delivery_tag)
    finally:
        if channel.is_open:
            channel.queue_delete(queue=retry_queue)
            channel.queue_delete(queue=main_queue)
            channel.exchange_delete(exchange=retry_exchange)
            channel.exchange_delete(exchange=main_exchange)

        if connection.is_open:
            connection.close()

"""Shared RabbitMQ connection factory."""

import pika


def create_connection(url: str) -> pika.BlockingConnection:
    return pika.BlockingConnection(pika.URLParameters(url))

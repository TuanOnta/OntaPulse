from pika.exceptions import AMQPConnectionError, ChannelClosedByBroker, ConnectionClosedByBroker

from ontapulse_worker.platform.resilience.errors import is_retryable_connection_error


def test_connection_errors_are_retryable() -> None:
    assert is_retryable_connection_error(AMQPConnectionError("unavailable"))
    assert is_retryable_connection_error(ConnectionClosedByBroker(320, "connection forced"))


def test_configuration_and_channel_errors_are_not_retryable() -> None:
    assert not is_retryable_connection_error(ChannelClosedByBroker(406, "invalid topology"))
    assert not is_retryable_connection_error(RuntimeError("invalid configuration"))

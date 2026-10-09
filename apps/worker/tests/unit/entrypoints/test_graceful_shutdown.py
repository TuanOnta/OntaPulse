import signal
from unittest.mock import Mock

import pytest
from pika.exceptions import AMQPConnectionError

from ontapulse_worker.entrypoints import worker
from ontapulse_worker.platform.config import Settings


def settings() -> Settings:
    return Settings.model_validate(
        {
            "NODE_ENV": "test",
            "DATABASE_URL": "postgresql://ontapulse:test@localhost/ontapulse_test",
            "RABBITMQ_URL": "amqp://local",
        }
    )


@pytest.mark.parametrize("shutdown_signal", [signal.SIGINT, signal.SIGTERM])
def test_signal_requests_consumer_shutdown_and_closes_resources(monkeypatch, shutdown_signal):
    monkeypatch.setattr(worker, "configure_logging", Mock())
    resources = Mock()
    consumer = resources.build_consumer.return_value
    handlers = {}

    def install_signal(signum, handler):
        if callable(handler):
            handlers[signum] = handler
        return signal.SIG_DFL

    def run_consumer(**_kwargs):
        handlers[shutdown_signal](shutdown_signal, None)

    consumer.run.side_effect = run_consumer
    monkeypatch.setattr(worker, "load_settings", Mock(return_value=settings()))
    monkeypatch.setattr(worker, "Container", Mock(return_value=resources))
    monkeypatch.setattr(worker.signal, "signal", install_signal)

    worker.main()

    assert set(handlers) == {signal.SIGINT, signal.SIGTERM}
    consumer.request_shutdown.assert_called_once_with()
    resources.close.assert_called_once_with()


def test_shutdown_cancels_connection_retry_wait():
    resources = Mock()
    resources.build_consumer.side_effect = AMQPConnectionError("unavailable")
    shutdown = Mock(requested=False)
    shutdown.wait.return_value = True

    worker.run_worker(resources, shutdown)

    shutdown.wait.assert_called_once()
    assert resources.build_consumer.call_count == 1

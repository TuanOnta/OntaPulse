from unittest.mock import Mock

import pytest
from pika.exceptions import AMQPConnectionError

from ontapulse_worker.bootstrap import container
from ontapulse_worker.entrypoints import worker
from ontapulse_worker.platform.config.settings import Settings


def settings() -> Settings:
    return Settings.model_validate(
        {
            "NODE_ENV": "test",
            "DATABASE_URL": "postgresql://ontapulse:test@localhost/ontapulse_test",
            "RABBITMQ_URL": "amqp://local",
        }
    )


@pytest.mark.parametrize("failure", [None, KeyboardInterrupt(), RuntimeError("failed")])
def test_worker_closes_resources_after_consumption(monkeypatch, failure):
    monkeypatch.setattr(worker, "configure_logging", Mock())
    resources = Mock()
    consumer = resources.build_consumer.return_value
    consumer.run.side_effect = failure
    monkeypatch.setattr(worker, "load_settings", Mock(return_value=settings()))
    monkeypatch.setattr(worker, "Container", Mock(return_value=resources))

    if isinstance(failure, RuntimeError):
        with pytest.raises(RuntimeError, match="failed"):
            worker.main()
    else:
        worker.main()

    consumer.run.assert_called_once()
    resources.close.assert_called_once_with()


def test_worker_disposes_engine_when_bootstrap_fails(monkeypatch):
    monkeypatch.setattr(worker, "configure_logging", Mock())
    engine = Mock()
    monkeypatch.setattr(worker, "load_settings", Mock(return_value=settings()))
    monkeypatch.setattr(container, "create_database_engine", Mock(return_value=engine))
    monkeypatch.setattr(container, "check_database", Mock(side_effect=RuntimeError("unavailable")))

    with pytest.raises(RuntimeError, match="unavailable"):
        worker.main()

    engine.dispose.assert_called_once_with()


def test_container_wires_scan_handler_and_closes_resources(monkeypatch):
    engine, executor, repository, consumer = Mock(), Mock(), Mock(), Mock()
    monkeypatch.setattr(container, "create_database_engine", Mock(return_value=engine))
    monkeypatch.setattr(container, "check_database", Mock())
    monkeypatch.setattr(container, "create_session_factory", Mock())
    monkeypatch.setattr(
        container.sqlalchemy_scan_repository,
        "SqlAlchemyScanRepository",
        Mock(return_value=repository),
    )
    monkeypatch.setattr(container, "HttpScanExecutor", Mock(return_value=executor))
    consumer_factory = Mock(return_value=consumer)
    monkeypatch.setattr(container, "RabbitMqScanConsumer", consumer_factory)
    resources = container.Container(settings())

    try:
        assert resources.build_consumer() is consumer
        job = Mock()
        repository.claim.return_value = None
        consumer_factory.call_args.kwargs["handler"](job)
        repository.claim.assert_called_once_with(job)
        executor.execute.assert_not_called()
    finally:
        resources.close()

    executor.close.assert_called_once_with()
    engine.dispose.assert_called_once_with()


def test_connection_failure_retries_with_backoff(monkeypatch):
    resources = Mock()
    resources.build_consumer.side_effect = [
        AMQPConnectionError("unavailable"),
        Mock(),
    ]
    sleep = Mock()
    monkeypatch.setattr(worker, "sleep", sleep)

    worker.run_worker(resources)

    assert resources.build_consumer.call_count == 2
    sleep.assert_called_once()


def test_non_connection_failure_propagates_without_retry(monkeypatch):
    resources = Mock()
    resources.build_consumer.side_effect = RuntimeError("invalid configuration")
    sleep = Mock()
    monkeypatch.setattr(worker, "sleep", sleep)

    with pytest.raises(RuntimeError, match="invalid configuration"):
        worker.run_worker(resources)

    sleep.assert_not_called()

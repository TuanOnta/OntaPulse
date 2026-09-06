from unittest.mock import Mock

import pytest

from ontapulse_worker.bootstrap import container
from ontapulse_worker.entrypoints import worker


@pytest.mark.parametrize("failure", [None, KeyboardInterrupt(), RuntimeError("failed")])
def test_worker_closes_resources_after_consumption(monkeypatch, capsys, failure):
    monkeypatch.setattr(worker, "configure_logging", Mock())
    resources = Mock()
    consumer = resources.build_consumer.return_value
    consumer.run.side_effect = failure
    monkeypatch.setattr(worker, "WorkerContainer", Mock(return_value=resources))

    if isinstance(failure, RuntimeError):
        with pytest.raises(RuntimeError, match="failed"):
            worker.main()
    else:
        worker.main()

    consumer.run.assert_called_once_with()
    resources.close.assert_called_once_with()
    assert "worker.stopped" in capsys.readouterr().out


def test_worker_disposes_engine_when_bootstrap_fails(monkeypatch):
    monkeypatch.setattr(worker, "configure_logging", Mock())
    engine = Mock()
    monkeypatch.setattr(
        container, "load_settings", Mock(return_value=Mock(rabbitmq_url="amqp://local"))
    )
    monkeypatch.setattr(container, "create_database_engine", Mock(return_value=engine))
    monkeypatch.setattr(container, "check_database", Mock(side_effect=RuntimeError("unavailable")))

    with pytest.raises(RuntimeError, match="unavailable"):
        worker.main()

    engine.dispose.assert_called_once_with()


def test_container_wires_scan_handler_and_closes_resources(monkeypatch):
    engine, executor, repository, consumer = Mock(), Mock(), Mock(), Mock()
    monkeypatch.setattr(
        container, "load_settings", Mock(return_value=Mock(rabbitmq_url="amqp://local"))
    )
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
    resources = container.WorkerContainer()

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

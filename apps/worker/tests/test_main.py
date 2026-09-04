import json
from unittest.mock import Mock

import pytest
from sqlalchemy import Engine

from ontapulse_worker import main as worker_main


def test_main_checks_and_disposes_the_database(monkeypatch: pytest.MonkeyPatch, capsys) -> None:
    engine = Mock(spec=Engine)
    check_database = Mock()

    monkeypatch.setattr(worker_main, "load_settings", Mock(return_value=object()))
    monkeypatch.setattr(worker_main, "create_database_engine", Mock(return_value=engine))
    monkeypatch.setattr(worker_main, "check_database", check_database)

    worker_main.main()

    check_database.assert_called_once_with(engine)
    engine.dispose.assert_called_once_with()
    assert json.loads(capsys.readouterr().out) == {
        "level": "info",
        "event": "worker.database_ready",
    }


def test_main_reports_database_failure_without_error_details(
    monkeypatch: pytest.MonkeyPatch, capsys
) -> None:
    engine = Mock(spec=Engine)

    monkeypatch.setattr(worker_main, "load_settings", Mock(return_value=object()))
    monkeypatch.setattr(worker_main, "create_database_engine", Mock(return_value=engine))
    monkeypatch.setattr(
        worker_main,
        "check_database",
        Mock(side_effect=RuntimeError("postgresql://user:secret@localhost/database")),
    )

    with pytest.raises(SystemExit, match="1"):
        worker_main.main()

    engine.dispose.assert_called_once_with()
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "secret" not in captured.err
    assert json.loads(captured.err) == {
        "level": "error",
        "event": "worker.database_unavailable",
    }

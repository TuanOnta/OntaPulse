from unittest.mock import Mock

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session

from ontapulse_worker import database
from ontapulse_worker.config import Settings
from ontapulse_worker.database import (
    create_database_engine,
    create_session_factory,
    sqlalchemy_database_url,
)


def test_postgresql_url_uses_psycopg_driver() -> None:
    assert (
        sqlalchemy_database_url("postgresql://ontapulse:test@localhost:5433/ontapulse")
        == "postgresql+psycopg://ontapulse:test@localhost:5433/ontapulse"
    )


def test_database_engine_is_created_without_connecting() -> None:
    settings = Settings.model_validate(
        {
            "NODE_ENV": "test",
            "DATABASE_URL": "postgresql://ontapulse:test@localhost:5433/ontapulse_test",
        }
    )

    engine = create_database_engine(settings)

    try:
        assert engine.url.drivername == "postgresql+psycopg"
    finally:
        engine.dispose()


def test_database_engine_has_a_bounded_connection_timeout(monkeypatch) -> None:
    settings = Settings.model_validate(
        {
            "NODE_ENV": "test",
            "DATABASE_URL": "postgresql://ontapulse:test@localhost:5433/ontapulse_test",
        }
    )
    engine = Mock(spec=Engine)
    create_engine_mock = Mock(return_value=engine)
    monkeypatch.setattr(database, "create_engine", create_engine_mock)

    assert database.create_database_engine(settings) is engine
    create_engine_mock.assert_called_once_with(
        "postgresql+psycopg://ontapulse:test@localhost:5433/ontapulse_test",
        connect_args={"connect_timeout": 5},
        pool_pre_ping=True,
    )


def test_session_factory_uses_the_supplied_engine() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    session_factory = create_session_factory(engine)

    try:
        with session_factory() as session:
            assert isinstance(session, Session)
            assert session.get_bind() is engine
    finally:
        engine.dispose()

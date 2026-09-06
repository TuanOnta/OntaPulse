from pathlib import Path

import pytest
from pydantic import ValidationError

from ontapulse_worker.platform.config.settings import (
    REPOSITORY_ROOT,
    WORKER_ROOT,
    Settings,
    default_env_file,
    load_settings,
)


def test_package_paths_point_to_the_worker_and_repository() -> None:
    assert WORKER_ROOT == REPOSITORY_ROOT / "apps" / "worker"


def test_test_settings_do_not_require_rabbitmq() -> None:
    settings = Settings.model_validate(
        {
            "NODE_ENV": "test",
            "DATABASE_URL": "postgresql://ontapulse:test@localhost:5433/ontapulse_test",
        }
    )

    assert settings.node_env == "test"
    assert settings.rabbitmq_url is None


def test_non_test_settings_require_rabbitmq() -> None:
    with pytest.raises(ValidationError, match="RABBITMQ_URL is required outside test mode"):
        Settings.model_validate(
            {
                "NODE_ENV": "development",
                "DATABASE_URL": "postgresql://ontapulse:test@localhost:5433/ontapulse",
            }
        )


def test_load_settings_reads_an_explicit_env_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env"
    env_file.write_text(
        "\n".join(
            [
                "NODE_ENV=development",
                "DATABASE_URL=postgresql://ontapulse:test@localhost:5433/ontapulse",
                "RABBITMQ_URL=amqp://ontapulse:test@localhost:5672",
            ]
        ),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.node_env == "development"
    assert str(settings.rabbitmq_url) == "amqp://ontapulse:test@localhost:5672"


def test_default_env_file_uses_test_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("NODE_ENV", "test")

    assert default_env_file() == REPOSITORY_ROOT / ".env.test"


def test_default_env_file_uses_development_environment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("NODE_ENV", raising=False)

    assert default_env_file() == REPOSITORY_ROOT / ".env"

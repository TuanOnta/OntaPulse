from pathlib import Path

import pytest
from pydantic import ValidationError

from ontapulse_worker.platform.config import (
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


class TestDnsResolvers:
    def settings(self, **env: str):
        from ontapulse_worker.platform.config import Settings

        return Settings(
            NODE_ENV="test", DATABASE_URL="postgresql://u:p@localhost:5433/db_test", **env
        )

    def test_the_default_resolvers_are_three_public_addresses(self) -> None:
        assert self.settings().dns_resolver_addresses == ("1.1.1.1", "8.8.8.8", "9.9.9.9")

    def test_a_custom_list_is_trimmed_and_normalized(self) -> None:
        settings = self.settings(DNS_RESOLVERS=" 9.9.9.9 , 2606:4700:4700:0:0:0:0:1111 ,,")

        assert settings.dns_resolver_addresses == ("9.9.9.9", "2606:4700:4700::1111")

    @pytest.mark.parametrize(
        "value",
        [
            "10.0.0.1",
            "192.168.1.1",
            "172.16.0.5",
            "127.0.0.1",
            "169.254.169.254",
            "::1",
            "fe80::1",
            "0.0.0.0",
            "1.1.1.1,10.0.0.2",
        ],
    )
    def test_an_internal_resolver_can_never_be_configured(self, value: str) -> None:
        with pytest.raises(ValueError, match="public"):
            self.settings(DNS_RESOLVERS=value)

    @pytest.mark.parametrize("value", ["dns.example.com", "1.1.1", "not an ip"])
    def test_a_host_name_is_not_a_resolver_address(self, value: str) -> None:
        with pytest.raises(ValueError, match="IP"):
            self.settings(DNS_RESOLVERS=value)

    @pytest.mark.parametrize("value", ["", " , ,"])
    def test_an_empty_list_is_an_error(self, value: str) -> None:
        with pytest.raises(ValueError, match="at least one"):
            self.settings(DNS_RESOLVERS=value)

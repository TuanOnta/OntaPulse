import ipaddress
import os
from pathlib import Path
from typing import Literal, Self

from pydantic import AnyUrl, Field, PostgresDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WORKER_ROOT = Path(__file__).resolve().parents[2]
REPOSITORY_ROOT = WORKER_ROOT.parents[1]


DEFAULT_DNS_RESOLVERS = "1.1.1.1,8.8.8.8,9.9.9.9"


def parse_public_resolvers(value: str) -> tuple[str, ...]:
    """Resolver IPs from a comma separated list. Only public addresses are accepted.

    DNS watch must never query an internal resolver (docs/security-checks.md section 11), so a
    private, loopback, link-local, or otherwise non-global address is a configuration error.
    """
    addresses: list[str] = []

    for item in value.split(","):
        text = item.strip()

        if not text:
            continue

        try:
            address = ipaddress.ip_address(text)
        except ValueError as error:
            raise ValueError("DNS_RESOLVERS must list IP addresses") from error

        if not address.is_global:
            raise ValueError("DNS_RESOLVERS must list public addresses only")

        addresses.append(str(address))

    if not addresses:
        raise ValueError("DNS_RESOLVERS needs at least one address")

    return tuple(addresses)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore", populate_by_name=True)

    node_env: Literal["development", "test", "production"] = Field(alias="NODE_ENV")
    database_url: PostgresDsn = Field(alias="DATABASE_URL")
    rabbitmq_url: AnyUrl | None = Field(default=None, alias="RABBITMQ_URL")
    dns_resolvers: str = Field(default=DEFAULT_DNS_RESOLVERS, alias="DNS_RESOLVERS")

    @model_validator(mode="after")
    def require_public_dns_resolvers(self) -> Self:
        parse_public_resolvers(self.dns_resolvers)

        return self

    @property
    def dns_resolver_addresses(self) -> tuple[str, ...]:
        return parse_public_resolvers(self.dns_resolvers)

    @model_validator(mode="after")
    def require_rabbitmq_outside_test(self) -> Self:
        if self.node_env != "test" and self.rabbitmq_url is None:
            raise ValueError("RABBITMQ_URL is required outside test mode")

        return self


def default_env_file() -> Path:
    filename = ".env.test" if os.environ.get("NODE_ENV") == "test" else ".env"
    return REPOSITORY_ROOT / filename


def load_settings(env_file: Path | None = None) -> Settings:
    return Settings(_env_file=env_file or default_env_file(), _env_file_encoding="utf-8")

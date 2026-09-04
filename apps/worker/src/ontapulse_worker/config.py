import os
from pathlib import Path
from typing import Literal, Self

from pydantic import AnyUrl, Field, PostgresDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(case_sensitive=True, extra="ignore", populate_by_name=True)

    node_env: Literal["development", "test", "production"] = Field(alias="NODE_ENV")
    database_url: PostgresDsn = Field(alias="DATABASE_URL")
    rabbitmq_url: AnyUrl | None = Field(default=None, alias="RABBITMQ_URL")

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

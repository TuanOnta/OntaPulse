from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session, sessionmaker

from ontapulse_worker.config import Settings

DATABASE_CONNECT_TIMEOUT_SECONDS = 5


def sqlalchemy_database_url(database_url: object) -> str:
    url = str(database_url)

    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)

    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)

    return url


def create_database_engine(settings: Settings) -> Engine:
    return create_engine(
        sqlalchemy_database_url(settings.database_url),
        connect_args={"connect_timeout": DATABASE_CONNECT_TIMEOUT_SECONDS},
        pool_pre_ping=True,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False)


def check_database(engine: Engine) -> None:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

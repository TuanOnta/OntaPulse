"""Worker dependency composition and resource ownership."""

from sqlalchemy import Engine

from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.consumer import RabbitMqScanConsumer
from ontapulse_worker.modules.scans.adapters.outbound.http.http_scan_executor import (
    HttpScanExecutor,
)
from ontapulse_worker.modules.scans.adapters.outbound.persistence import sqlalchemy_scan_repository
from ontapulse_worker.modules.scans.application.services.scan_lifecycle import ScanLifecycleService
from ontapulse_worker.platform.config.settings import Settings
from ontapulse_worker.platform.database.sqlalchemy import (
    check_database,
    create_database_engine,
    create_session_factory,
)


class Container:
    """Compose the scan worker and own its process-scoped resources."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self.engine: Engine | None = None
        self.executor: HttpScanExecutor | None = None
        self._lifecycle: ScanLifecycleService | None = None

    def build_consumer(self) -> RabbitMqScanConsumer:
        if self._settings.rabbitmq_url is None:
            raise RuntimeError("RabbitMQ URL is required")

        if self.engine is None:
            self.engine = create_database_engine(self._settings)

        check_database(self.engine)

        if self._lifecycle is None:
            sessions = create_session_factory(self.engine)
            repository = sqlalchemy_scan_repository.SqlAlchemyScanRepository(sessions)
            self.executor = HttpScanExecutor()
            self._lifecycle = ScanLifecycleService(repository, self.executor)

        return RabbitMqScanConsumer(
            url=str(self._settings.rabbitmq_url),
            handler=self._lifecycle.handle,
        )

    def close(self) -> None:
        if self.executor is not None:
            self.executor.close()
        if self.engine is not None:
            self.engine.dispose()

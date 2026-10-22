"""Worker dependency composition and resource ownership."""

from sqlalchemy import Engine

from ontapulse_worker.modules.dns_watch.adapters.dnspython_resolver import DnspythonResolver
from ontapulse_worker.modules.dns_watch.adapters.sqlalchemy_dns_store import (
    SqlAlchemyDnsWatchStore,
)
from ontapulse_worker.modules.dns_watch.application.dns_watch_scan import DnsWatchExecutor
from ontapulse_worker.modules.scans.adapters import sqlalchemy_scan_repository
from ontapulse_worker.modules.scans.adapters.http.http_scan_executor import (
    HttpScanExecutor,
)
from ontapulse_worker.modules.scans.adapters.rabbitmq.consumer import RabbitMqScanConsumer
from ontapulse_worker.modules.scans.application.scan_lifecycle import ScanLifecycleService
from ontapulse_worker.modules.scans.domain.models import ScanKind
from ontapulse_worker.modules.security_posture.adapters.http.pinned_httpx_client import (
    PinnedHttpxClient,
)
from ontapulse_worker.modules.security_posture.adapters.tls.ssl_tls_inspector import (
    SslTlsInspector,
)
from ontapulse_worker.modules.security_posture.application.posture_scan import (
    PostureScanExecutor,
)
from ontapulse_worker.platform.config import Settings
from ontapulse_worker.platform.database import (
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
        self.posture_client: PinnedHttpxClient | None = None
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
            self.posture_client = PinnedHttpxClient()
            self._lifecycle = ScanLifecycleService(
                repository,
                self.executor,
                executors={
                    ScanKind.SECURITY_POSTURE: PostureScanExecutor(
                        self.posture_client, SslTlsInspector()
                    ),
                    ScanKind.DNS_WATCH: DnsWatchExecutor(
                        DnspythonResolver(self._settings.dns_resolver_addresses),
                        SqlAlchemyDnsWatchStore(sessions),
                    ),
                },
            )

        return RabbitMqScanConsumer(
            url=str(self._settings.rabbitmq_url),
            handler=self._lifecycle.handle,
        )

    def close(self) -> None:
        if self.executor is not None:
            self.executor.close()
        if self.posture_client is not None:
            self.posture_client.close()
        if self.engine is not None:
            self.engine.dispose()

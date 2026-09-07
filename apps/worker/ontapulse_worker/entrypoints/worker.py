"""Worker process entrypoint."""

import logging
import signal
from threading import Event
from types import FrameType

from ontapulse_worker.bootstrap.container import Container
from ontapulse_worker.modules.scans.adapters.inbound.rabbitmq.consumer import RabbitMqScanConsumer
from ontapulse_worker.platform.config.settings import load_settings
from ontapulse_worker.platform.observability.logging import configure_logging
from ontapulse_worker.platform.resilience.backoff import ExponentialBackoff
from ontapulse_worker.platform.resilience.errors import is_retryable_connection_error

logger = logging.getLogger(__name__)


class WorkerShutdown:
    def __init__(self) -> None:
        self._requested = Event()
        self._consumer: RabbitMqScanConsumer | None = None

    @property
    def requested(self) -> bool:
        return self._requested.is_set()

    def request(self) -> bool:
        first_request = not self._requested.is_set()
        self._requested.set()

        if self._consumer is not None:
            self._consumer.request_shutdown()

        return first_request

    def attach(self, consumer: RabbitMqScanConsumer) -> None:
        self._consumer = consumer

        if self.requested:
            consumer.request_shutdown()

    def detach(self, consumer: RabbitMqScanConsumer) -> None:
        if self._consumer is consumer:
            self._consumer = None

    def wait(self, timeout: float) -> bool:
        return self._requested.wait(timeout)


def run_worker(container: Container, shutdown: WorkerShutdown | None = None) -> None:
    backoff = ExponentialBackoff()
    shutdown = shutdown or WorkerShutdown()

    while not shutdown.requested:
        consumer: RabbitMqScanConsumer | None = None

        try:
            consumer = container.build_consumer()
            shutdown.attach(consumer)
            consumer.run(on_ready=backoff.reset)
            return
        except Exception as error:
            if shutdown.requested:
                return

            if not is_retryable_connection_error(error):
                raise

            delay = backoff.next_delay()
            logger.warning(
                "worker.connection_retry",
                extra={"error_type": type(error).__name__, "delay_seconds": round(delay, 2)},
            )

            if shutdown.wait(delay):
                return
        finally:
            if consumer is not None:
                shutdown.detach(consumer)


def main() -> None:
    configure_logging()
    container = Container(load_settings())
    shutdown = WorkerShutdown()
    logger.info("worker.started")

    def handle_shutdown(signum: int, _frame: FrameType | None) -> None:
        if shutdown.request():
            logger.info(
                "worker.shutdown_requested",
                extra={"signal": signal.Signals(signum).name},
            )

    handled_signals = (signal.SIGINT, signal.SIGTERM)
    previous_handlers = {
        handled_signal: signal.signal(handled_signal, handle_shutdown)
        for handled_signal in handled_signals
    }

    try:
        run_worker(container, shutdown)
    except KeyboardInterrupt:
        logger.info("worker.interrupted")
    except Exception as error:
        logger.exception("worker.failed", extra={"error_type": type(error).__name__})
        raise
    finally:
        for handled_signal, previous_handler in previous_handlers.items():
            signal.signal(handled_signal, previous_handler)

        container.close()
        logger.info("worker.stopped")


if __name__ == "__main__":
    main()

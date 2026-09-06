"""Worker process entrypoint."""

import logging
from time import sleep

from ontapulse_worker.bootstrap.container import Container
from ontapulse_worker.platform.config.settings import load_settings
from ontapulse_worker.platform.observability.logging import configure_logging
from ontapulse_worker.platform.resilience.backoff import ExponentialBackoff
from ontapulse_worker.platform.resilience.errors import is_retryable_connection_error

logger = logging.getLogger(__name__)


def run_worker(container: Container) -> None:
    backoff = ExponentialBackoff()

    while True:
        try:
            consumer = container.build_consumer()
            consumer.run(on_ready=backoff.reset)
            return
        except Exception as error:
            if not is_retryable_connection_error(error):
                raise

            delay = backoff.next_delay()
            logger.warning(
                "worker.connection_retry",
                extra={"error_type": type(error).__name__, "delay_seconds": round(delay, 2)},
            )
            sleep(delay)


def main() -> None:
    configure_logging()
    container = Container(load_settings())
    logger.info("worker.started")

    try:
        run_worker(container)
    except KeyboardInterrupt:
        logger.info("worker.interrupted")
    except Exception as error:
        logger.exception("worker.failed", extra={"error_type": type(error).__name__})
        raise
    finally:
        container.close()
        logger.info("worker.stopped")


if __name__ == "__main__":
    main()

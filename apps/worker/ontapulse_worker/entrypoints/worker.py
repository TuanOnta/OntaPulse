"""Long-running OntaPulse worker entrypoint."""

from ontapulse_worker.bootstrap.container import WorkerContainer
from ontapulse_worker.platform.observability.logging import configure_logging, log_event


def main() -> None:
    configure_logging()
    container = WorkerContainer()
    try:
        consumer = container.build_consumer()
        log_event("info", "worker.started")
        consumer.run()
    except KeyboardInterrupt:
        log_event("info", "worker.shutdown_requested")
    except Exception as error:
        log_event("error", "worker.failed", error_type=type(error).__name__)
        raise
    finally:
        container.close()
        log_event("info", "worker.stopped")


if __name__ == "__main__":
    main()

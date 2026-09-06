"""Worker database readiness check."""

import json
import sys

from sqlalchemy import Engine

from ontapulse_worker.platform.config.settings import load_settings
from ontapulse_worker.platform.database.sqlalchemy import check_database, create_database_engine


def main() -> None:
    engine: Engine | None = None

    try:
        settings = load_settings()
        engine = create_database_engine(settings)
        check_database(engine)

    except Exception:
        print(
            json.dumps(
                {
                    "level": "error",
                    "event": "worker.database_unavailable",
                }
            ),
            file=sys.stderr,
        )
        raise SystemExit(1) from None

    finally:
        if engine is not None:
            engine.dispose()

    print(
        json.dumps(
            {
                "level": "info",
                "event": "worker.database_ready",
            }
        )
    )


if __name__ == "__main__":
    main()

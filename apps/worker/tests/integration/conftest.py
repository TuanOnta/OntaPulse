import os

import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        if "/integration/" in str(item.path).replace("\\", "/"):
            item.add_marker(pytest.mark.infrastructure)
            if os.environ.get("WORKER_INFRA_TESTS") != "1":
                item.add_marker(pytest.mark.skip(reason="Set WORKER_INFRA_TESTS=1 explicitly"))

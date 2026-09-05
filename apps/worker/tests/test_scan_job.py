from types import SimpleNamespace
from uuid import UUID

import pytest

from ontapulse_worker.scan_job import InvalidScanMessage, parse_scan_job

SCAN_ID = "f7ad663f-bde8-4dc9-8281-5594d6c73c28"
MONITOR_ID = "3edca2bb-c92c-4ac8-a5ed-75630416f604"


def properties(**overrides):
    values = {
        "content_type": "application/json",
        "message_id": SCAN_ID,
        "type": "scan.requested",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_parse_scan_job_accepts_the_queue_contract() -> None:
    job = parse_scan_job(
        f'{{"scanId":"{SCAN_ID}","monitorId":"{MONITOR_ID}"}}'.encode(), properties()
    )

    assert job.scan_id == UUID(SCAN_ID)
    assert job.monitor_id == UUID(MONITOR_ID)


@pytest.mark.parametrize(
    ("body", "property_overrides"),
    [
        (b"not-json", {}),
        (b"{}", {}),
        (
            f'{{"scanId":"{SCAN_ID}","monitorId":"{MONITOR_ID}","extra":true}}'.encode(),
            {},
        ),
        (
            f'{{"scanId":"{SCAN_ID}","monitorId":"{MONITOR_ID}"}}'.encode(),
            {"content_type": "text/plain"},
        ),
        (
            f'{{"scanId":"{SCAN_ID}","monitorId":"{MONITOR_ID}"}}'.encode(),
            {"type": "other.event"},
        ),
        (
            f'{{"scanId":"{SCAN_ID}","monitorId":"{MONITOR_ID}"}}'.encode(),
            {"message_id": MONITOR_ID},
        ),
    ],
)
def test_parse_scan_job_rejects_contract_violations(body: bytes, property_overrides: dict) -> None:
    with pytest.raises(InvalidScanMessage):
        parse_scan_job(body, properties(**property_overrides))

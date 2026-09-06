from typing import Protocol

from pydantic import ValidationError

from ontapulse_worker.modules.scans.domain.models import ScanJob

SCAN_MESSAGE_CONTENT_TYPE = "application/json"
SCAN_MESSAGE_TYPE = "scan.requested"


class InvalidScanMessage(ValueError):
    """Raised when a delivery does not satisfy the shared queue contract."""


class ScanMessageProperties(Protocol):
    content_type: str | None
    message_id: str | None
    type: str | None


def parse_scan_job(body: bytes, properties: ScanMessageProperties) -> ScanJob:
    if properties.content_type != SCAN_MESSAGE_CONTENT_TYPE:
        raise InvalidScanMessage("unexpected content type")

    if properties.type != SCAN_MESSAGE_TYPE:
        raise InvalidScanMessage("unexpected message type")

    try:
        job = ScanJob.model_validate_json(body)
    except ValidationError as error:
        raise InvalidScanMessage("invalid scan payload") from error

    if properties.message_id != str(job.scan_id):
        raise InvalidScanMessage("message ID does not match scan ID")

    return job

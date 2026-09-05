from collections.abc import Callable
from typing import Protocol
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError

SCAN_MESSAGE_CONTENT_TYPE = "application/json"
SCAN_MESSAGE_TYPE = "scan.requested"


class ScanJob(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    scan_id: UUID = Field(alias="scanId")
    monitor_id: UUID = Field(alias="monitorId")


class ScanMessageProperties(Protocol):
    content_type: str | None
    message_id: str | None
    type: str | None


class InvalidScanMessage(ValueError):
    """Raised when a delivery does not satisfy the shared queue contract."""


class PermanentScanJobError(Exception):
    """Raised when retrying a valid scan job cannot succeed."""


ScanJobHandler = Callable[[ScanJob], None]


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

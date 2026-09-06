"""Scan lifecycle errors."""


class ScanExecutionError(Exception):
    def __init__(self, safe_message: str) -> None:
        super().__init__(safe_message)
        self.safe_message = safe_message


class PermanentScanJobError(Exception):
    """Raised when retrying a valid scan job cannot succeed."""


class ScanJobInProgressError(RuntimeError):
    """Raised when another delivery has already claimed the scan."""


class ScanStateConflictError(RuntimeError):
    """Raised when a scan changes state outside the active lifecycle."""

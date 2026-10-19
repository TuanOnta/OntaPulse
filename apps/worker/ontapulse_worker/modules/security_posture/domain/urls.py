"""Derive the two request URLs of a posture scan from the monitor URL."""

from urllib.parse import urlsplit, urlunsplit

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError


def derive_posture_urls(target_url: str) -> tuple[str, str]:
    """Return `(https_url, http_url)` for the monitor host.

    A URL already using a scheme is kept as is (fragment removed); the other scheme uses the
    default port and the same path and query. Userinfo is rejected.
    """
    try:
        parts = urlsplit(target_url)
        hostname = parts.hostname
        port = parts.port
    except ValueError as error:
        raise ScanExecutionError("Scan target URL is invalid") from error

    if parts.scheme not in {"http", "https"} or hostname is None:
        raise ScanExecutionError("Scan target URL is invalid")

    if parts.username is not None or parts.password is not None:
        raise ScanExecutionError("Scan target URL is invalid")

    host = f"[{hostname}]" if ":" in hostname else hostname
    path = parts.path or "/"
    own = urlunsplit((parts.scheme, parts.netloc, path, parts.query, ""))
    other_scheme = "http" if parts.scheme == "https" else "https"
    other = urlunsplit((other_scheme, host, path, parts.query, ""))

    if port is not None and not (1 <= port <= 65_535):
        raise ScanExecutionError("Scan target URL is invalid")

    return (own, other) if parts.scheme == "https" else (other, own)

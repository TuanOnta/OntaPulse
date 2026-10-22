"""Pure evaluation of exposed-file probes (docs/security-checks.md sections 7 and 8).

The allowlist and the signatures are constants. Only the first 4 KB of a body is
matched, in memory; the body and any matched text are never kept: a finding carries the
path, the HTTP status, and the signature name. Signature sources: the git glossary
(`ref: refs/...` symref), the git hash function transition document (object names are 40
or 64 hex digits), and git-config (`[core]` section). The dotenv signature is a
heuristic.
"""

import re
from dataclasses import dataclass

from ontapulse_worker.modules.scans.domain.models import FindingConfidence, ScanFinding
from ontapulse_worker.modules.security_posture.domain.catalog import make_finding

MAX_PROBE_BODY_BYTES = 4_096

SIGNATURE_DOTENV = "dotenv"
SIGNATURE_GIT_HEAD = "git_head"
SIGNATURE_GIT_CONFIG = "git_config"

_DOTENV_LINE = re.compile(r"^[A-Z][A-Z0-9_]*=", re.MULTILINE)
_GIT_OBJECT_NAME = re.compile(r"[0-9a-f]{40}|[0-9a-f]{64}")
_HTML_START = ("<!doctype", "<html")


@dataclass(frozen=True)
class ProbePath:
    path: str
    signature: str
    check_id: str


# Adding a path needs review and a catalog change. The request budget equals the size of this tuple.
PROBE_ALLOWLIST: tuple[ProbePath, ...] = (
    ProbePath("/.env", SIGNATURE_DOTENV, "SEC_EXPOSED_ENV_FILE"),
    ProbePath("/.git/HEAD", SIGNATURE_GIT_HEAD, "SEC_EXPOSED_GIT_HEAD"),
    ProbePath("/.git/config", SIGNATURE_GIT_CONFIG, "SEC_EXPOSED_GIT_CONFIG"),
)
MAX_PATH_PROBE_REQUESTS = len(PROBE_ALLOWLIST)
STATUS_ONLY_CHECK_ID = "SEC_EXPOSED_PATH_STATUS_ONLY"


def matches_signature(signature: str, text: str) -> bool:
    if signature == SIGNATURE_DOTENV:
        return _DOTENV_LINE.search(text) is not None

    if signature == SIGNATURE_GIT_HEAD:
        stripped = text.strip()

        return stripped.startswith("ref: refs/") or _GIT_OBJECT_NAME.fullmatch(stripped) is not None

    if signature == SIGNATURE_GIT_CONFIG:
        return "[core]" in text

    return False


def looks_like_html(text: str) -> bool:
    return text.lstrip().lower().startswith(_HTML_START)


def evaluate_probe(probe: ProbePath, status_code: int, body_prefix: bytes) -> ScanFinding | None:
    """One finding when the path serves what it should not, otherwise None."""
    if status_code != 200:
        return None

    text = body_prefix[:MAX_PROBE_BODY_BYTES].decode("utf-8", errors="replace")

    # A single-page app answers every path with its HTML shell: not a match, not even status-only.
    if looks_like_html(text):
        return None

    if matches_signature(probe.signature, text):
        return make_finding(
            probe.check_id,
            {"path": probe.path, "status": status_code, "signature": probe.signature},
            FindingConfidence.HIGH,
        )

    return make_finding(
        STATUS_ONLY_CHECK_ID,
        {"path": probe.path, "status": status_code},
        FindingConfidence.LOW,
    )

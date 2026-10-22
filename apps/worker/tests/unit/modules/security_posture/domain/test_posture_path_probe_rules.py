import json

import pytest

from ontapulse_worker.modules.scans.domain.models import (
    FindingCategory,
    FindingConfidence,
    FindingSeverity,
)
from ontapulse_worker.modules.security_posture.domain.path_probe_rules import (
    MAX_PATH_PROBE_REQUESTS,
    MAX_PROBE_BODY_BYTES,
    PROBE_ALLOWLIST,
    ProbePath,
    evaluate_probe,
    looks_like_html,
    matches_signature,
)

ENV = PROBE_ALLOWLIST[0]
HEAD = PROBE_ALLOWLIST[1]
CONFIG = PROBE_ALLOWLIST[2]
SHA1 = "0123456789abcdef0123456789abcdef01234567"
SHA256 = "0123456789abcdef" * 4


def finding_ids(probe: ProbePath, status: int, body: bytes) -> list[str]:
    finding = evaluate_probe(probe, status, body)

    return [] if finding is None else [finding.check_id]


def test_the_allowlist_is_the_three_catalog_paths_and_the_budget_equals_its_size() -> None:
    assert [(item.path, item.signature) for item in PROBE_ALLOWLIST] == [
        ("/.env", "dotenv"),
        ("/.git/HEAD", "git_head"),
        ("/.git/config", "git_config"),
    ]
    assert MAX_PATH_PROBE_REQUESTS == 3
    assert MAX_PROBE_BODY_BYTES == 4096


@pytest.mark.parametrize(
    ("probe", "body", "expected"),
    [
        (ENV, b"APP_KEY=base64:abc\nDEBUG=true\n", ["SEC_EXPOSED_ENV_FILE"]),
        (ENV, b"# comment\n\nDB_HOST=localhost\n", ["SEC_EXPOSED_ENV_FILE"]),
        (ENV, b"A=1", ["SEC_EXPOSED_ENV_FILE"]),
        (ENV, b"lowercase=1\n", ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (ENV, b"=novalue\n", ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (ENV, b"just some text\n", ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (HEAD, b"ref: refs/heads/main\n", ["SEC_EXPOSED_GIT_HEAD"]),
        (HEAD, f"{SHA1}\n".encode(), ["SEC_EXPOSED_GIT_HEAD"]),
        (HEAD, SHA256.encode(), ["SEC_EXPOSED_GIT_HEAD"]),
        (HEAD, b"ref: heads/main\n", ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (HEAD, b"0123abcd\n", ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (HEAD, (SHA1.upper()).encode(), ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (HEAD, (SHA1 + "00").encode(), ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (CONFIG, b"[core]\n\trepositoryformatversion = 0\n", ["SEC_EXPOSED_GIT_CONFIG"]),
        (CONFIG, b'[remote "origin"]\n\turl = x\n', ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
        (CONFIG, b'{"ok": true}', ["SEC_EXPOSED_PATH_STATUS_ONLY"]),
    ],
)
def test_a_200_is_matched_against_the_signature_of_its_path(probe, body, expected) -> None:
    assert finding_ids(probe, 200, body) == expected


@pytest.mark.parametrize("status", [301, 302, 401, 403, 404, 410, 429, 500, 503])
def test_only_a_200_can_be_a_finding(status: int) -> None:
    for probe in PROBE_ALLOWLIST:
        assert evaluate_probe(probe, status, b"APP_KEY=x\n[core]\nref: refs/heads/main") is None


@pytest.mark.parametrize(
    "body",
    [
        b"<!DOCTYPE html><html><body>APP_KEY=x [core]</body></html>",
        b"<!doctype html>\n<title>x</title>",
        b"  \n<html lang=en>",
        b"<HTML>",
    ],
)
def test_a_single_page_app_fallback_is_neither_a_match_nor_status_only(body: bytes) -> None:
    for probe in PROBE_ALLOWLIST:
        assert evaluate_probe(probe, 200, body) is None


def test_html_detection_ignores_leading_whitespace_and_case() -> None:
    assert looks_like_html("\n\t <!DocType html>")
    assert not looks_like_html("APP=<html>")
    assert not looks_like_html("")


def test_a_matched_finding_uses_the_catalog_severity_and_high_confidence() -> None:
    expected = {
        "/.env": ("SEC_EXPOSED_ENV_FILE", FindingSeverity.CRITICAL, b"K=V\n"),
        "/.git/HEAD": ("SEC_EXPOSED_GIT_HEAD", FindingSeverity.HIGH, b"ref: refs/heads/x"),
        "/.git/config": ("SEC_EXPOSED_GIT_CONFIG", FindingSeverity.HIGH, b"[core]"),
    }

    for probe in PROBE_ALLOWLIST:
        check_id, severity, body = expected[probe.path]
        finding = evaluate_probe(probe, 200, body)

        assert finding is not None
        assert finding.check_id == check_id
        assert finding.code == check_id
        assert finding.severity is severity
        assert finding.category is FindingCategory.EXPOSED_FILES
        assert finding.confidence is FindingConfidence.HIGH


def test_a_status_only_finding_is_low_with_low_confidence() -> None:
    finding = evaluate_probe(ENV, 200, b"nothing that matches")

    assert finding is not None
    assert finding.check_id == "SEC_EXPOSED_PATH_STATUS_ONLY"
    assert finding.severity is FindingSeverity.LOW
    assert finding.confidence is FindingConfidence.LOW
    assert finding.evidence == {"path": "/.env", "status": 200}


def test_evidence_holds_only_the_path_status_and_signature_never_content() -> None:
    secret = "SUPER_SECRET_TOKEN_VALUE_123"
    body = f"APP_KEY=base64:{secret}\nDB_PASSWORD={secret}\n".encode()

    finding = evaluate_probe(ENV, 200, body)

    assert finding is not None
    assert finding.evidence == {"path": "/.env", "status": 200, "signature": "dotenv"}
    assert secret not in json.dumps(finding.evidence)
    assert secret not in finding.description
    assert secret not in finding.title
    assert secret not in (finding.recommendation or "")


def test_only_the_first_4_kb_is_considered() -> None:
    padding = b"x" * MAX_PROBE_BODY_BYTES

    assert evaluate_probe(ENV, 200, padding + b"\nAPP_KEY=late\n").check_id == (
        "SEC_EXPOSED_PATH_STATUS_ONLY"
    )
    assert evaluate_probe(ENV, 200, b"APP_KEY=early\n" + padding).check_id == (
        "SEC_EXPOSED_ENV_FILE"
    )


def test_binary_garbage_does_not_raise() -> None:
    assert evaluate_probe(CONFIG, 200, b"\xff\xfe\x00\x01[core") is not None
    assert evaluate_probe(ENV, 200, b"") is not None


def test_an_unknown_signature_never_matches() -> None:
    assert matches_signature("nope", "APP_KEY=x") is False

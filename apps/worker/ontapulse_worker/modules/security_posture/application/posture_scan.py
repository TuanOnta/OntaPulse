"""Orchestration of one SECURITY_POSTURE scan (ScanExecutor port implementation)."""

import logging
from collections.abc import Callable
from time import perf_counter

from ontapulse_worker.modules.scans.domain.errors import ScanExecutionError
from ontapulse_worker.modules.scans.domain.models import (
    ScanFinding,
    ScanResult,
    SubCheckResult,
    SubCheckState,
)
from ontapulse_worker.modules.security_posture.application.ports import (
    PostureConnectionError,
    PostureHttpClient,
)
from ontapulse_worker.modules.security_posture.domain.catalog import (
    MAX_REQUESTS_PER_SCAN,
    REASON_CHALLENGE_RESPONSE,
    REASON_CONNECTION_FAILED,
    SUB_CHECK_COOKIES,
    SUB_CHECK_CORS,
    SUB_CHECK_HEADERS,
    SUB_CHECK_REDIRECT,
)
from ontapulse_worker.modules.security_posture.domain.challenge import (
    ChallengeKind,
    classify_challenge,
    mark_possible_challenge,
)
from ontapulse_worker.modules.security_posture.domain.cookie_rules import evaluate_cookies
from ontapulse_worker.modules.security_posture.domain.cors_rules import evaluate_cors
from ontapulse_worker.modules.security_posture.domain.header_rules import evaluate_headers
from ontapulse_worker.modules.security_posture.domain.models import PostureResponse
from ontapulse_worker.modules.security_posture.domain.redirect_rules import evaluate_redirect
from ontapulse_worker.modules.security_posture.domain.urls import derive_posture_urls

logger = logging.getLogger(__name__)


class RequestBudgetExceededError(RuntimeError):
    """A third request was attempted; this is a programming error, never a target condition."""


class RequestBudget:
    def __init__(self, limit: int = MAX_REQUESTS_PER_SCAN) -> None:
        self._remaining = limit

    def consume(self) -> None:
        if self._remaining <= 0:
            raise RequestBudgetExceededError("posture request budget exhausted")

        self._remaining -= 1


class PostureScanExecutor:
    """Run the response-based posture checks with at most two requests."""

    def __init__(
        self,
        client: PostureHttpClient,
        *,
        clock: Callable[[], float] = perf_counter,
    ) -> None:
        self._client = client
        self._clock = clock

    def execute(self, target_url: str) -> ScanResult:
        https_url, http_url = derive_posture_urls(target_url)
        budget = RequestBudget()
        started_at = self._clock()

        # ScanExecutionError (non-public or unresolvable target) ends the scan right away.
        https_response = self._fetch(budget, https_url)
        http_response = self._fetch(budget, http_url)

        if https_response is None and http_response is None:
            raise ScanExecutionError("Scan target is unavailable")

        findings: list[ScanFinding] = []
        sub_checks: list[SubCheckResult] = []

        findings.extend(self._https_checks(https_response, sub_checks))
        findings.extend(self._redirect_check(http_response, sub_checks))

        elapsed_ms = max(0, round((self._clock() - started_at) * 1_000))
        logger.info(
            "posture.sub_checks",
            extra={
                "sub_checks": {item.name: item.state.value for item in sub_checks},
                "finding_count": len(findings),
            },
        )

        return ScanResult(
            status_code=https_response.status_code if https_response else None,
            response_time_ms=https_response.elapsed_ms if https_response else elapsed_ms,
            findings=tuple(findings),
            sub_checks=tuple(sub_checks),
        )

    def _fetch(self, budget: RequestBudget, url: str) -> PostureResponse | None:
        budget.consume()

        try:
            return self._client.fetch(url)
        except PostureConnectionError:
            return None

    @staticmethod
    def _https_checks(
        response: PostureResponse | None,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        names = (SUB_CHECK_HEADERS, SUB_CHECK_COOKIES, SUB_CHECK_CORS)

        if response is None:
            sub_checks.extend(_skipped(name, REASON_CONNECTION_FAILED) for name in names)
            return []

        challenge = classify_challenge(response)

        if challenge is ChallengeKind.CONFIRMED:
            sub_checks.extend(_skipped(name, REASON_CHALLENGE_RESPONSE) for name in names)
            return []

        findings: list[ScanFinding] = []
        findings.extend(evaluate_headers(response))
        findings.extend(evaluate_cookies(response.cookies))
        findings.extend(evaluate_cors(response))
        sub_checks.extend(SubCheckResult(name, SubCheckState.RAN) for name in names)

        return (
            mark_possible_challenge(findings) if challenge is ChallengeKind.POSSIBLE else findings
        )

    @staticmethod
    def _redirect_check(
        response: PostureResponse | None,
        sub_checks: list[SubCheckResult],
    ) -> list[ScanFinding]:
        if response is None:
            sub_checks.append(_skipped(SUB_CHECK_REDIRECT, REASON_CONNECTION_FAILED))
            return []

        challenge = classify_challenge(response)

        if challenge is ChallengeKind.CONFIRMED:
            sub_checks.append(_skipped(SUB_CHECK_REDIRECT, REASON_CHALLENGE_RESPONSE))
            return []

        findings = evaluate_redirect(response)
        sub_checks.append(SubCheckResult(SUB_CHECK_REDIRECT, SubCheckState.RAN))

        return (
            mark_possible_challenge(findings) if challenge is ChallengeKind.POSSIBLE else findings
        )


def _skipped(name: str, reason: str) -> SubCheckResult:
    return SubCheckResult(name, SubCheckState.SKIPPED, reason)
